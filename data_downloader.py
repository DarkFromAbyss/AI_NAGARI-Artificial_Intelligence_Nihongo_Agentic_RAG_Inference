import argparse
import logging
import os
from pathlib import Path
from typing import List

import gdown
import yaml
from pydantic import BaseModel, Field, ValidationError, validator
from tqdm import tqdm

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)

class DownloadConfig(BaseModel):
    """Schema for validating CLI arguments for folder download."""

    url: str = Field(..., description="Google Drive folder URL")
    target_dir: Path = Field(..., description="Destination directory for downloaded data")

    @validator("url")
    def validate_drive_url(cls, value: str) -> str:
        normalized = value.strip()
        if "drive.google.com" not in normalized or "/folders/" not in normalized:
            raise ValueError("URL must be a Google Drive folder link containing '/folders/'.")
        return normalized

    @validator("target_dir", pre=True)
    def validate_target_dir(cls, value: str) -> Path:
        path = Path(value).expanduser().resolve()
        if path.exists() and not path.is_dir():
            raise ValueError(f"Target path exists and is not a directory: {path}")
        try:
            path.mkdir(parents=True, exist_ok=True)
        except OSError as error:
            raise ValueError(f"Cannot create target directory: {error}") from error
        if not os.access(path, os.W_OK):
            raise ValueError(f"Target directory is not writable: {path}")
        return path


def parse_arguments() -> DownloadConfig:
    """Parse CLI arguments and return validated configuration."""
    parser = argparse.ArgumentParser(
        description="Download a Google Drive folder to a local directory and update config.yaml."
    )
    parser.add_argument(
        "--url",
        "-u",
        required=True,
        help="Google Drive folder link to download.",
    )
    parser.add_argument(
        "--file",
        "-f",
        required=True,
        help="Destination directory for downloaded data.",
    )
    args = parser.parse_args()
    try:
        return DownloadConfig(url=args.url, target_dir=args.file)
    except ValidationError as error:
        logger.error("CLI validation failed: %s", error)
        raise SystemExit(1)


def download_drive_folder(url: str, target_dir: Path) -> List[Path]:
    """Download the entire Google Drive folder to the destination directory."""
    logger.info("Starting Drive folder download: %s", url)
    downloaded_paths = gdown.download_folder(
        url,
        output=str(target_dir),
        quiet=True,
        use_cookies=False,
    )

    if not downloaded_paths:
        raise RuntimeError("Download failed or no files were found at the provided URL.")

    file_paths = [Path(path).resolve() for path in downloaded_paths if path]
    logger.info("Downloaded %d entries to %s", len(file_paths), target_dir)

    for file_path in tqdm(file_paths, desc="Verifying downloaded files", unit="file"):
        if not file_path.exists():
            raise FileNotFoundError(f"Expected downloaded file missing: {file_path}")
    return file_paths


def update_config(download_dir: Path, config_path: Path = Path("config.yaml")) -> Path:
    """Create or update config.yaml with the absolute data directory path."""
    config_data = {}
    if config_path.exists():
        try:
            with config_path.open("r", encoding="utf-8") as file_handle:
                config_data = yaml.safe_load(file_handle) or {}
        except yaml.YAMLError as error:
            logger.warning("Existing config.yaml could not be parsed: %s", error)

    config_data["data_directory"] = str(download_dir.resolve())
    with config_path.open("w", encoding="utf-8") as file_handle:
        yaml.safe_dump(config_data, file_handle)

    logger.info("Updated config file at %s", config_path.resolve())
    return config_path.resolve()


def generate_directory_tree(root_dir: Path) -> None:
    """Print a visual tree of the downloaded folder contents."""

    def _walk(directory: Path, prefix: str = "") -> None:
        entries = sorted(directory.iterdir(), key=lambda item: (item.is_file(), item.name.lower()))
        for index, entry in enumerate(entries):
            is_last = index == len(entries) - 1
            connector = "└── " if is_last else "├── "
            print(prefix + connector + entry.name)
            if entry.is_dir():
                extension = "    " if is_last else "│   "
                _walk(entry, prefix + extension)

    print(root_dir)
    _walk(root_dir)


def main() -> None:
    """Execute the downloader workflow from parsing to config update."""
    config = parse_arguments()
    try:
        download_drive_folder(config.url, config.target_dir)
        config_file = update_config(config.target_dir)
        print(f"\nDownloaded directory: {config.target_dir.resolve()}")
        print(f"Config file: {config_file}\n")
        generate_directory_tree(config.target_dir)
        logger.info("Data download workflow finished successfully.")
    except Exception as error:
        logger.exception("Data download workflow failed")
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
    
