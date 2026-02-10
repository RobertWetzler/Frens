#!/bin/bash
# Generates a self-signed certificate for HTTPS development with LAN IP support
# Usage: ./gen-dev-cert.sh [--trust]
# The --trust flag will attempt to add the cert to the macOS keychain

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CERT_DIR="$PROJECT_ROOT/src/Cliq.Server/certs"
CERT_NAME="dev-lan-cert"
CERT_DAYS=365

# Get LAN IP (same logic as gen-dev-ip.js)
get_lan_ip() {
    # Try to get the primary LAN IP on macOS
    local ip
    ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
    
    # Fallback: parse ifconfig for first private IP
    if [ -z "$ip" ]; then
        ip=$(ifconfig 2>/dev/null | grep -E 'inet (192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)' | head -1 | awk '{print $2}')
    fi
    
    echo "$ip"
}

LAN_IP=$(get_lan_ip)

if [ -z "$LAN_IP" ]; then
    echo "⚠️  Could not detect LAN IP, using localhost only"
    LAN_IP="127.0.0.1"
fi

echo "🔐 Generating dev certificate for IP: $LAN_IP"

# Create certs directory
mkdir -p "$CERT_DIR"

# Create OpenSSL config with SAN
OPENSSL_CNF="$CERT_DIR/openssl.cnf"
cat > "$OPENSSL_CNF" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = US
ST = Development
L = Local
O = Frens Dev
OU = Development
CN = localhost

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = $LAN_IP
EOF

# Generate private key
openssl genrsa -out "$CERT_DIR/$CERT_NAME.key" 2048 2>/dev/null

# Generate certificate
openssl req -new -x509 \
    -key "$CERT_DIR/$CERT_NAME.key" \
    -out "$CERT_DIR/$CERT_NAME.crt" \
    -days $CERT_DAYS \
    -config "$OPENSSL_CNF" \
    2>/dev/null

# Create PFX for ASP.NET Core (no password)
openssl pkcs12 -export \
    -out "$CERT_DIR/$CERT_NAME.pfx" \
    -inkey "$CERT_DIR/$CERT_NAME.key" \
    -in "$CERT_DIR/$CERT_NAME.crt" \
    -passout pass: \
    2>/dev/null

# Write metadata file for other scripts to read
cat > "$CERT_DIR/cert-info.json" << EOF
{
  "ip": "$LAN_IP",
  "certPath": "$CERT_DIR/$CERT_NAME.pfx",
  "crtPath": "$CERT_DIR/$CERT_NAME.crt",
  "keyPath": "$CERT_DIR/$CERT_NAME.key",
  "generatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo "✅ Certificate generated:"
echo "   PFX: $CERT_DIR/$CERT_NAME.pfx"
echo "   CRT: $CERT_DIR/$CERT_NAME.crt"
echo "   KEY: $CERT_DIR/$CERT_NAME.key"
echo "   IP:  $LAN_IP"

# Trust the certificate if requested
if [ "$1" = "--trust" ]; then
    echo ""
    echo "🔓 Adding certificate to macOS keychain (requires sudo)..."
    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$CERT_DIR/$CERT_NAME.crt"
    echo "✅ Certificate trusted in system keychain"
fi

echo ""
echo "📝 To use HTTPS with this cert, run the server with:"
echo "   ASPNETCORE_Kestrel__Certificates__Default__Path=$CERT_DIR/$CERT_NAME.pfx \\"
echo "   dotnet run --launch-profile https-lan"
echo ""
echo "💡 If mobile devices show cert errors, either:"
echo "   1. Run this script with --trust to add to system keychain"
echo "   2. Or install $CERT_NAME.crt on your mobile device"
