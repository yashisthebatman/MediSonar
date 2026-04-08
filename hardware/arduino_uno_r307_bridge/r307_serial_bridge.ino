// MediSonar R307S bridge for Arduino Uno R3.
//
// Wiring:
// - R307S TX -> Arduino pin 2
// - R307S RX -> Arduino pin 3 through a 5V-to-3.3V level shifter or divider if required
// - R307S VCC -> 5V
// - R307S GND -> GND
//
// Upload this sketch, then set backend FINGERPRINT_SERIAL_PORT to the Arduino COM port.

#include <SoftwareSerial.h>

SoftwareSerial sensorSerial(2, 3); // RX, TX

void setup() {
  Serial.begin(57600);
  sensorSerial.begin(57600);
}

void loop() {
  while (Serial.available() > 0) {
    sensorSerial.write(Serial.read());
  }

  while (sensorSerial.available() > 0) {
    Serial.write(sensorSerial.read());
  }
}
