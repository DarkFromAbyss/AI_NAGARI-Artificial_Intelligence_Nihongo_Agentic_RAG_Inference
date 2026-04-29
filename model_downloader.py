import argparse
import logging
from pathlib import Path
from typing import Optional

import yaml
from huggingface_hub import snapshot_download
from pydantic import BaseModel, Field, ValidationError, validator

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)


class ModelDownloadConfigSchema(BaseModel):
    """Schema for validating Hugging Face model download parameters."""

    repo_id: str = Field(..., description="Hugging Face repository ID (e.g., Qwen/Qwen2.5-7B-Instruct)")
    download_dir: Path = Field(..., description="Local destination directory for model")
    access_token: Optional[str] = Field(
        default=None,
        description="Hugging Face access token for gated models",
    )

    @validator("repo_id")
    def validate_repo_id(cls, value: str) -> str:
        normalized = value.strip()
        if "/" not in normalized or len(normalized.split("/")) != 2:
            raise ValueError("Repository ID must follow format 'owner/repo' (e.g., 'Qwen/Qwen2.5-7B-Instruct').")
        return normalized

    @validator("download_dir", pre=True)
    def validate_download_dir(cls, value: str) -> Path:
        path = Path(value).expanduser().resolve()
        if path.exists() and not path.is_dir():
            raise ValueError(f"Download path exists and is not a directory: {path}")
        return path


def parse_arguments() -> ModelDownloadConfigSchema:
    """Parse CLI arguments and return validated model download configuration."""
    parser = argparse.ArgumentParser(
        description="Download a Hugging Face LLM model to a local directory.",
    )
    parser.add_argument(
        "--repo",
        "-rp",
        required=True,
        help="Hugging Face repository ID (format: owner/repo).",
    )
    parser.add_argument(
        "--file",
        "-f",
        required=True,
        help="Destination directory for the downloaded model.",
    )
    parser.add_argument(
        "--access_token",
        "-a_t",
        required=False,
        help="Hugging Face access token for authentication with gated models.",
    )
    args = parser.parse_args()
    try:
        return ModelDownloadConfigSchema(
            repo_id=args.repo,
            download_dir=args.file,
            access_token=args.access_token,
        )
    except ValidationError as error:
        logger.error("CLI argument validation failed: %s", error)
        raise SystemExit(1)


def ensure_directory_exists(directory: Path) -> Path:
    """Ensure the download directory exists, creating it if necessary.

    Uses pathlib for robust path handling and automatic parent directory creation.
    Logs the creation event for auditability.

    Args:
        directory: Path to the directory to ensure exists.

    Returns:
        The resolved Path object.

    Raises:
        OSError: If directory creation fails due to permissions or filesystem issues.
    """
    if not directory.exists():
        directory.mkdir(parents=True, exist_ok=True)
        logger.info("Directory did not exist. Created new directory at: %s", directory)
    return directory


def update_config_yaml(repo_id: str, local_path: Path) -> None:
    """Update config.yaml with the downloaded model's local path.

    Safely loads existing config.yaml, updates the 'models' section with the repo_id
    and absolute path, then writes back. Creates config.yaml if it doesn't exist.
    Uses pyyaml for safe YAML serialization to prevent data corruption.

    Args:
        repo_id: Hugging Face repository ID (e.g., 'Qwen/Qwen2.5-7B-Instruct').
        local_path: Absolute Path to the downloaded model directory.
    """
    config_path = Path("config.yaml")
    config_data = {}
    if config_path.exists():
        try:
            with config_path.open("r", encoding="utf-8") as file_handle:
                config_data = yaml.safe_load(file_handle) or {}
        except yaml.YAMLError as error:
            logger.warning("Failed to parse existing config.yaml: %s", error)

    if "models" not in config_data:
        config_data["models"] = {}
    config_data["models"][repo_id] = str(local_path)

    with config_path.open("w", encoding="utf-8") as file_handle:
        yaml.safe_dump(config_data, file_handle)

    logger.info("Successfully updated config.yaml with the new model path for repo: %s", repo_id)


def download_hf_model(config: ModelDownloadConfigSchema) -> Path:
    """Download a model from Hugging Face Hub to the specified directory.

    Uses snapshot_download() to fetch all model files with progress tracking.
    The Hugging Face Hub integrates native tqdm progress bars.

    Args:
        config: Validated model download configuration.

    Returns:
        Path object pointing to the downloaded model directory.

    Raises:
        RuntimeError: If download fails due to authentication or network issues.
        FileNotFoundError: If the repository does not exist.
    """
    logger.info("Starting Hugging Face model download for repo=%s", config.repo_id)
    try:
        model_path = snapshot_download(
            repo_id=config.repo_id,
            cache_dir=str(config.download_dir),
            token=config.access_token,
            local_dir=str(config.download_dir),
        )
        final_path = Path(model_path).resolve()
        logger.info("Model downloaded successfully to %s", final_path)
        return final_path
    except Exception as error:
        logger.exception("Failed to download model from Hugging Face Hub")
        raise RuntimeError(f"Model download failed: {error}") from error


def display_directory_tree(root_dir: Path) -> None:
    """Print a visual tree of the downloaded model directory to standard output.

    Args:
        root_dir: Path to the root directory to display.
    """

    def _walk(directory: Path, prefix: str = "") -> None:
        try:
            entries = sorted(directory.iterdir(), key=lambda item: (item.is_file(), item.name.lower()))
        except PermissionError:
            logger.warning("Permission denied reading directory: %s", directory)
            return

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
    """Execute the model downloader workflow from parsing to display."""
    config = parse_arguments()
    config.download_dir = ensure_directory_exists(config.download_dir)
    try:
        logger.info("Validating download configuration")
        model_directory = download_hf_model(config)
        update_config_yaml(config.repo_id, model_directory)
        print(f"\n✓ Model download completed successfully.")
        print(f"  Storage location: {model_directory}\n")
        display_directory_tree(model_directory)
        logger.info("Model downloader workflow finished successfully.")
    except Exception as error:
        logger.exception("Model downloader workflow failed")
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
