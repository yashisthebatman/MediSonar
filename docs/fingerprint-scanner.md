# Fingerprint Blood Group Scanner

## Current Flow

MediSonar uses the existing model at:

`fingerprint-based-blood-group-detection-main/test/model_blood_group_detection_resnet.h5`

The system does not retrain that model. It:

1. Calls `POST /api/fingerprint/scan`
2. Reads a fingerprint frame from an R30x/R307-compatible scanner over serial
3. Converts the raw grayscale buffer into a temporary BMP
4. Resizes to `256x256`
5. Applies ResNet50 preprocessing
6. Runs the saved Keras model and returns the predicted blood group

## Backend File

Implementation now lives in:

`backend/app/services/fingerprint.py`

## Hardware Logic Review Notes

The scanner integration now includes a safer serial read loop so partial reads do not incorrectly fail mid-packet.

Important behavior:

- Auto-detects a likely serial device when possible
- Accepts an explicit serial port override
- Times out cleanly when no finger is detected
- Deletes temporary image files after inference

## Environment

Set the serial port if auto-detection is not enough:

```powershell
$env:FINGERPRINT_SERIAL_PORT="COM3"
```

Or put it in `backend/.env`.

## Arduino Bridge

If you are using the Arduino serial bridge, upload:

`hardware/arduino_uno_r307_bridge/r307_serial_bridge.ino`

Recommended wiring:

- R307S TX -> Arduino pin 2
- R307S RX -> Arduino pin 3 through a suitable level-shifting path if needed
- R307S VCC -> 5V
- R307S GND -> GND

Keep the baud rate aligned with your module and the backend request. The current default is `57600`.

## Test Without Hardware

You can verify the model path without the scanner:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:8000/api/fingerprint/scan `
  -ContentType "application/json" `
  -Body '{"test_image_path":"C:\\Users\\yvcha\\Desktop\\MediSonar\\fingerprint-based-blood-group-detection-main\\test\\O- blood group.BMP"}'
```

## Medical Warning

This is an experimental model estimate, not a clinical blood-group test. Any real use must be verified through standard medical testing.
