"""Pack extension/ into dist/x-video-gate.zip with manifest.json at the zip root."""
import pathlib
import zipfile

root = pathlib.Path(__file__).parent
src = root / "extension"
out = root / "dist" / "x-video-gate.zip"
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(src.iterdir()):
        z.write(f, f.name)
print(out, out.stat().st_size, "bytes")
