import os

cert_path = "/Users/user/R122579036.pfx"

print(f"Testing path: {cert_path}")
print(f"Exists: {os.path.exists(cert_path)}")
print(f"Is File: {os.path.isfile(cert_path)}")
print(f"Access (Read): {os.access(cert_path, os.R_OK)}")

try:
    with open(cert_path, 'rb') as f:
        print("Successfully opened file for reading.")
        content = f.read(10)
        print(f"First 10 bytes: {content}")
except Exception as e:
    print(f"Failed to open file: {e}")
