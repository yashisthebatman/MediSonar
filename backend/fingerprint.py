from __future__ import annotations

import time
from functools import lru_cache
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Optional


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_PATH = (
    ROOT_DIR
    / "fingerprint-based-blood-group-detection-main"
    / "test"
    / "model_blood_group_detection_resnet.h5"
)

BLOOD_GROUP_LABELS = {
    0: "A+",
    1: "A-",
    2: "AB+",
    3: "AB-",
    4: "B+",
    5: "B-",
    6: "O+",
    7: "O-",
}


class FingerprintError(RuntimeError):
    """Raised when capture or prediction cannot be completed."""


def _missing_dependency_error(package: str, install_name: Optional[str] = None) -> FingerprintError:
    name = install_name or package
    return FingerprintError(
        f"Missing dependency '{package}'. Install backend requirements first, including '{name}'."
    )


@lru_cache(maxsize=1)
def _load_model(model_path: str):
    try:
        from tensorflow.keras.models import load_model
    except ImportError as exc:
        raise _missing_dependency_error("tensorflow") from exc

    path = Path(model_path)
    if not path.exists():
        raise FingerprintError(f"Fingerprint model file was not found at: {path}")
    return load_model(path)


def predict_blood_group_from_image(image_path: Path, model_path: Path = DEFAULT_MODEL_PATH) -> dict:
    try:
        import numpy as np
        from PIL import Image
        from tensorflow.keras.applications.resnet50 import preprocess_input
    except ImportError as exc:
        missing = getattr(exc, "name", "tensorflow/Pillow/numpy")
        install_name = "pillow" if missing == "PIL" else missing
        raise _missing_dependency_error(missing, install_name) from exc

    path = Path(image_path)
    if not path.exists():
        raise FingerprintError(f"Fingerprint image was not found at: {path}")

    model = _load_model(str(model_path))
    with Image.open(path) as img:
        img = img.convert("RGB").resize((256, 256))
        x = np.asarray(img, dtype=np.float32)

    x = np.expand_dims(x, axis=0)
    x = preprocess_input(x)
    result = model.predict(x, verbose=0)
    predicted_index = int(np.argmax(result[0]))
    confidence = float(result[0][predicted_index] * 100)

    return {
        "blood_group": BLOOD_GROUP_LABELS.get(predicted_index, "Unknown"),
        "confidence": round(confidence, 2),
        "model": str(model_path),
    }


class R30xFingerprintScanner:
    START_CODE = b"\xEF\x01"
    DEFAULT_ADDRESS = b"\xFF\xFF\xFF\xFF"
    COMMAND_PACKET = 0x01
    DATA_PACKET = 0x02
    ACK_PACKET = 0x07
    END_DATA_PACKET = 0x08

    CMD_GET_IMAGE = 0x01
    CMD_UPLOAD_IMAGE = 0x0A

    OK = 0x00
    NO_FINGER = 0x02

    IMAGE_WIDTH = 256
    IMAGE_HEIGHT = 288
    RAW_IMAGE_BYTES = IMAGE_WIDTH * IMAGE_HEIGHT // 2

    def __init__(
        self,
        port: str,
        baud_rate: int = 57600,
        password: int = 0,
        timeout: float = 2.0,
    ) -> None:
        try:
            import serial
        except ImportError as exc:
            raise _missing_dependency_error("serial", "pyserial") from exc

        self._serial = serial.Serial(port=port, baudrate=baud_rate, timeout=timeout)
        self.password = password

    def close(self) -> None:
        self._serial.close()

    def capture_image_to_file(self, timeout_seconds: float = 20.0) -> Path:
        self._wait_for_finger(timeout_seconds)
        raw_image = self._upload_image()
        return self._raw_image_to_temp_bmp(raw_image)

    def _wait_for_finger(self, timeout_seconds: float) -> None:
        deadline = time.monotonic() + timeout_seconds
        last_status = None
        while time.monotonic() < deadline:
            status_payload = self._send_command(bytes([self.CMD_GET_IMAGE]))
            if not status_payload:
                raise FingerprintError("Fingerprint scanner returned an empty response.")
            last_status = status_payload[0]
            if last_status == self.OK:
                return
            if last_status != self.NO_FINGER:
                raise FingerprintError(f"Fingerprint capture failed with status 0x{last_status:02X}.")
            time.sleep(0.25)
        raise FingerprintError("No finger detected before the scan timed out.")

    def _upload_image(self) -> bytes:
        ack = self._send_command(bytes([self.CMD_UPLOAD_IMAGE]))
        if not ack or ack[0] != self.OK:
            code = ack[0] if ack else None
            raise FingerprintError(f"Fingerprint image upload failed with status {code!r}.")

        chunks: list[bytes] = []
        while True:
            packet_type, payload = self._read_packet()
            if packet_type not in (self.DATA_PACKET, self.END_DATA_PACKET):
                raise FingerprintError(f"Unexpected fingerprint image packet type 0x{packet_type:02X}.")
            chunks.append(payload)
            if packet_type == self.END_DATA_PACKET:
                break

        raw = b"".join(chunks)
        if len(raw) < self.RAW_IMAGE_BYTES:
            raise FingerprintError(
                f"Scanner returned {len(raw)} image bytes; expected at least {self.RAW_IMAGE_BYTES}."
            )
        return raw[: self.RAW_IMAGE_BYTES]

    def _raw_image_to_temp_bmp(self, raw: bytes) -> Path:
        try:
            from PIL import Image
        except ImportError as exc:
            raise _missing_dependency_error("PIL", "pillow") from exc

        pixels = bytearray()
        for value in raw:
            pixels.append((value >> 4) * 17)
            pixels.append((value & 0x0F) * 17)

        image = Image.frombytes("L", (self.IMAGE_WIDTH, self.IMAGE_HEIGHT), bytes(pixels))
        with NamedTemporaryFile(prefix="medisonar_fingerprint_", suffix=".bmp", delete=False) as tmp:
            image.save(tmp.name, format="BMP")
            return Path(tmp.name)

    def _send_command(self, payload: bytes) -> bytes:
        self._write_packet(self.COMMAND_PACKET, payload)
        packet_type, response = self._read_packet()
        if packet_type != self.ACK_PACKET:
            raise FingerprintError(f"Expected scanner ACK packet, received 0x{packet_type:02X}.")
        return response

    def _write_packet(self, packet_type: int, payload: bytes) -> None:
        length = len(payload) + 2
        packet = bytearray(self.START_CODE)
        packet.extend(self.DEFAULT_ADDRESS)
        packet.append(packet_type)
        packet.extend(length.to_bytes(2, "big"))
        packet.extend(payload)
        checksum = packet_type + (length >> 8) + (length & 0xFF) + sum(payload)
        packet.extend((checksum & 0xFFFF).to_bytes(2, "big"))
        self._serial.write(bytes(packet))
        self._serial.flush()

    def _read_packet(self) -> tuple[int, bytes]:
        self._read_until_start_code()
        address = self._read_exact(4)
        if address != self.DEFAULT_ADDRESS:
            raise FingerprintError("Received fingerprint packet for an unexpected device address.")

        header = self._read_exact(3)
        packet_type = header[0]
        length = int.from_bytes(header[1:3], "big")
        if length < 2:
            raise FingerprintError("Received fingerprint packet with an invalid length.")

        payload = self._read_exact(length - 2)
        checksum = int.from_bytes(self._read_exact(2), "big")
        expected = (packet_type + header[1] + header[2] + sum(payload)) & 0xFFFF
        if checksum != expected:
            raise FingerprintError("Fingerprint packet checksum failed.")
        return packet_type, payload

    def _read_until_start_code(self) -> None:
        window = b""
        deadline = time.monotonic() + (self._serial.timeout or 2.0)
        while time.monotonic() < deadline:
            window = (window + self._serial.read(1))[-2:]
            if window == self.START_CODE:
                return
        raise FingerprintError("Timed out waiting for fingerprint scanner packet.")

    def _read_exact(self, size: int) -> bytes:
        data = self._serial.read(size)
        if len(data) != size:
            raise FingerprintError("Timed out while reading from fingerprint scanner.")
        return data


def detect_serial_port() -> Optional[str]:
    try:
        from serial.tools import list_ports
    except ImportError:
        return None

    ports = list(list_ports.comports())
    if not ports:
        return None

    arduino_keywords = ("arduino", "ch340", "usb serial", "usb-serial")
    for port in ports:
        haystack = f"{port.description} {port.manufacturer or ''}".lower()
        if any(keyword in haystack for keyword in arduino_keywords):
            return port.device
    return ports[0].device


def scan_and_predict(
    serial_port: Optional[str],
    baud_rate: int,
    timeout_seconds: float,
    test_image_path: Optional[Path] = None,
) -> dict:
    if test_image_path:
        return {
            **predict_blood_group_from_image(test_image_path),
            "source": "test_image",
            "image_path": str(test_image_path),
        }

    port = serial_port or detect_serial_port()
    if not port:
        raise FingerprintError(
            "No serial port was provided or auto-detected. Set FINGERPRINT_SERIAL_PORT or pass serial_port."
        )

    scanner = R30xFingerprintScanner(port=port, baud_rate=baud_rate)
    image_path: Optional[Path] = None
    try:
        image_path = scanner.capture_image_to_file(timeout_seconds=timeout_seconds)
        return {
            **predict_blood_group_from_image(image_path),
            "source": "scanner",
            "serial_port": port,
        }
    finally:
        scanner.close()
        if image_path and image_path.exists():
            image_path.unlink(missing_ok=True)
