#!/bin/bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"

# Set permissions for key.pem
chmod 664 key.pem

# Set permissions for cert.pem (optional, but recommended)
chmod 644 cert.pem