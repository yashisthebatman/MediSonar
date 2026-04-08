# Fingerprint Blood Group Scanner Setup

MediSonar uses the existing ResNet model at:

`fingerprint-based-blood-group-detection-main/test/model_blood_group_detection_resnet.h5`

It does not train a new model. The scan flow is:

1. The profile page calls `POST /api/fingerprint/scan`.
2. The backend talks to the R307S/R30x-compatible fingerprint module over serial.
3. The scanner returns a raw grayscale fingerprint image.
4. The backend resizes the image to `256x256`, applies ResNet preprocessing, and runs the saved `.h5` model.
5. The predicted blood group fills the profile dropdown.

## Backend Requirements

Install the updated backend requirements:

```powershell
cd backend
.\.venv\Scripts\pip.exe install -r requirements.txt
```

Set the Arduino COM port before starting FastAPI:

```powershell
$env:FINGERPRINT_SERIAL_PORT="COM3"
.\.venv\Scripts\uvicorn.exe main:app --reload
```

Use the COM port shown by Arduino IDE or Windows Device Manager.

## Arduino Uno R3 Bridge

Upload this sketch:

`hardware/arduino_uno_r307_bridge/r307_serial_bridge.ino`

Wiring:

- R307S TX -> Arduino pin 2
- R307S RX -> Arduino pin 3 through a level shifter or divider if your module RX is not 5V tolerant
- R307S VCC -> 5V
- R307S GND -> GND

The sketch forwards bytes between USB serial and the scanner. Keep both serial links at `57600` baud unless your module is configured differently.

## Test Without Hardware

The endpoint can run the existing model against a local image path:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/fingerprint/scan -ContentType 'application/json' -Body '{"test_image_path":"C:\\Users\\yvcha\\Desktop\\MediSonar\\fingerprint-based-blood-group-detection-main\\test\\O- blood group.BMP"}'
```

That path is for software verification only; the UI scan button uses the hardware path.

## Important Caveat

This is model-based prediction from a fingerprint image, not a clinical blood typing test. Treat the output as an experimental estimate and verify any medical decision with a standard blood group test.
