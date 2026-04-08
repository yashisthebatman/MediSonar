# Autism Vision Module

## What It Uses

- Notebook source: `Autism/classification-autism-resnet50-accuracy-79-13.ipynb`
- Checkpoint: `Autism/best_model.pt`
- Backend service: `backend/app/services/autism.py`
- Frontend page: `/autism-screening`

## Model Handling

The backend recreates the binary ResNet50 classifier described in the notebook:

- `resnet50(weights=ResNet50_Weights.DEFAULT)`
- final layer replaced with `Linear(2048, 1)`
- checkpoint state loaded from `best_model.pt`
- sigmoid applied to produce the binary probability

## Input Modes

- Webcam capture from the browser
- External camera selected from browser-visible devices
- Manual image upload

The frontend sends a base64 image to:

`POST /api/autism/predict`

## Response Payload

The backend returns:

- predicted label
- confidence
- autistic probability
- non-autistic probability
- model path
- strong disclaimer text

## Safety Warning

This feature is strictly experimental.

- Autism is not diagnosable from a single face image.
- This output should never be used as a medical or educational decision tool.
- Keep the UI disclaimer visible if you extend this feature further.
