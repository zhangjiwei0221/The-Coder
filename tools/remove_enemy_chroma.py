from pathlib import Path
import subprocess
import sys

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PYTHON = Path(sys.executable)
REMOVER = Path.home() / ".codex" / "skills" / ".system" / "imagegen" / "scripts" / "remove_chroma_key.py"

JOBS = {
    "bug": ("output/imagegen/enemy-set/bug-chroma.png", "img/enemies/bug.png"),
    "error": ("output/imagegen/enemy-set/error-chroma.png", "img/enemies/error.png"),
    "loop": ("output/imagegen/enemy-set/loop-chroma.png", "img/enemies/loop.png"),
    "branch": ("output/imagegen/enemy-set/branch-chroma.png", "img/enemies/branch.png"),
}


def run_job(name, src, dst):
    subprocess.run(
        [
            str(PYTHON),
            str(REMOVER),
            "--input",
            str(ROOT / src),
            "--out",
            str(ROOT / dst),
            "--auto-key",
            "border",
            "--soft-matte",
            "--transparent-threshold",
            "12",
            "--opaque-threshold",
            "220",
            "--despill",
        ],
        check=True,
    )
    img = Image.open(ROOT / dst)
    print(f"{name}: {img.mode} {img.size} bbox={img.getbbox()}")


def main():
    for name, (src, dst) in JOBS.items():
        run_job(name, src, dst)


if __name__ == "__main__":
    main()
