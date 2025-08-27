#!/bin/zsh
#
# generate-icons.zsh
#
# Resize a source image to match the dimensions and filenames of all PNGs
# found in a reference directory, writing the generated PNGs to a destination
# directory.
#
# Requirements: macOS (sips), zsh
#
# Usage:
#   scripts/generate-icons.zsh \
#     --source src/cliq.client/public/icons-new/icon.jpeg \
#     --reference-dir src/cliq.client/public \
#     --dest src/cliq.client/public/icons-new \
#     [--square] [--overwrite] [--dry-run]
#
# Options:
#   --source <file>         Source image (JPEG/PNG/etc.). If omitted, defaults to
#                           <dest>/icon.jpeg when that file exists.
#   --reference-dir <dir>   Directory containing reference PNGs that define sizes.
#   --dest <dir>            Output directory where generated PNGs will be written.
#   --square                Crop the source to a centered square before resizing.
#   --overwrite             Overwrite outputs if they already exist.
#   --dry-run               Print what would happen without writing files.
#
# Examples:
#   scripts/generate-icons.zsh \
#     --source src/cliq.client/public/icons-new/icon.jpeg \
#     --reference-dir src/cliq.client/public \
#     --dest src/cliq.client/public/icons-new --overwrite
#

set -euo pipefail

print_usage() {
  sed -n '1,80p' "$0" | sed 's/^# \{0,1\}//' | awk 'BEGIN{p=0} /Usage:/{p=1} p{print} /Examples:/{ex=1} ex && NR>4 && !/^$/{print}' | sed '1,1!b; s/.*/Usage:/'
  echo "\nFull help is in the script header."
}

if ! command -v sips >/dev/null 2>&1; then
  echo "Error: 'sips' not found. This script requires macOS 'sips'." >&2
  exit 1
fi

SOURCE=""
REF_DIR=""
DEST_DIR=""
SQUARE=false
OVERWRITE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      print_usage
      exit 0
      ;;
    --source)
      SOURCE="$2"; shift 2 ;;
    --reference-dir)
      REF_DIR="$2"; shift 2 ;;
    --dest)
      DEST_DIR="$2"; shift 2 ;;
    --square)
      SQUARE=true; shift ;;
    --overwrite)
      OVERWRITE=true; shift ;;
    --dry-run)
      DRY_RUN=true; shift ;;
    *)
      echo "Unknown option: $1" >&2
      print_usage
      exit 2
      ;;
  esac
done

if [[ -z "${REF_DIR}" || -z "${DEST_DIR}" ]]; then
  echo "Error: --reference-dir and --dest are required." >&2
  print_usage
  exit 2
fi

# Default SOURCE to <dest>/icon.jpeg when not explicitly set
if [[ -z "${SOURCE}" ]]; then
  if [[ -f "${DEST_DIR}/icon.jpeg" ]]; then
    SOURCE="${DEST_DIR}/icon.jpeg"
  else
    echo "Error: --source not provided and ${DEST_DIR}/icon.jpeg not found." >&2
    exit 2
  fi
fi

# Ensure dirs exist
if [[ ! -d "${REF_DIR}" ]]; then
  echo "Error: reference dir not found: ${REF_DIR}" >&2
  exit 2
fi
mkdir -p "${DEST_DIR}"

if [[ ! -f "${SOURCE}" ]]; then
  echo "Error: source image not found: ${SOURCE}" >&2
  exit 2
fi

echo "Source:         ${SOURCE}"
echo "Reference dir:  ${REF_DIR}"
echo "Destination:    ${DEST_DIR}"
echo "Crop square:    ${SQUARE}"
echo "Overwrite:      ${OVERWRITE}"
echo "Dry run:        ${DRY_RUN}"

# Optionally crop to square
WORK_SOURCE="${SOURCE}"
TMP_FILE=""
if ${SQUARE}; then
  sw=$(sips -g pixelWidth  "${SOURCE}" 2>/dev/null | awk '/pixelWidth/ {print $2}')
  sh=$(sips -g pixelHeight "${SOURCE}" 2>/dev/null | awk '/pixelHeight/ {print $2}')
  if [[ -z "${sw}" || -z "${sh}" ]]; then
    echo "Error: Unable to read dimensions for source image." >&2
    exit 3
  fi
  side=${sw}
  if (( sh < sw )); then side=${sh}; fi
  TMP_FILE=$(mktemp -t icon-square-XXXXXX.png)
  echo "Preparing square source (${side}x${side}) -> ${TMP_FILE}"
  if ! ${DRY_RUN}; then
    sips -s format png -c "${side}" "${side}" "${SOURCE}" --out "${TMP_FILE}" >/dev/null
  fi
  WORK_SOURCE="${TMP_FILE}"
fi

created=0 skipped=0 failed=0

for src in "${REF_DIR}"/*.png; do
  [[ -f "${src}" ]] || continue
  base=$(basename "${src}")
  out="${DEST_DIR}/${base}"

  w=$(sips -g pixelWidth  "${src}" 2>/dev/null | awk '/pixelWidth/ {print $2}')
  h=$(sips -g pixelHeight "${src}" 2>/dev/null | awk '/pixelHeight/ {print $2}')
  if [[ -z "${w}" || -z "${h}" ]]; then
    echo "[skip] ${base}: could not read reference dimensions"
    ((skipped+=1))
    continue
  fi

  if [[ -f "${out}" && ${OVERWRITE} == false ]]; then
    echo "[skip] ${base}: exists (use --overwrite to replace)"
    ((skipped+=1))
    continue
  fi

  echo "[make] ${base} ${w}x${h}"
  if ! ${DRY_RUN}; then
    if sips -s format png -z "${h}" "${w}" "${WORK_SOURCE}" --out "${out}" >/dev/null; then
      ((created+=1))
    else
      echo "[fail] ${base}"
      ((failed+=1))
    fi
  else
    ((created+=1))
  fi
done

[[ -n "${TMP_FILE}" && -f "${TMP_FILE}" ]] && rm -f "${TMP_FILE}"

echo "\nSummary: created=${created} skipped=${skipped} failed=${failed}"
exit 0
