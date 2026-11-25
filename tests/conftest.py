"""Shared pytest fixtures for all tests."""
import tempfile
import pytest
from pathlib import Path
from unittest.mock import Mock, patch
import os
import shutil


@pytest.fixture
def temp_dir():
    """Create a temporary directory for test files."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        yield Path(tmp_dir)


@pytest.fixture
def temp_file():
    """Create a temporary file for tests."""
    with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
        yield Path(tmp_file.name)
    # Clean up
    try:
        os.unlink(tmp_file.name)
    except FileNotFoundError:
        pass


@pytest.fixture
def mock_subprocess():
    """Mock subprocess.run for testing command execution."""
    with patch('subprocess.run') as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = b"mock output"
        mock_run.return_value.stderr = b""
        yield mock_run


@pytest.fixture
def mock_git():
    """Mock git commands for testing."""
    with patch('subprocess.run') as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = b"mock git output"
        mock_run.return_value.check_returncode.return_value = None
        yield mock_run


@pytest.fixture
def sample_config():
    """Provide sample configuration data for tests."""
    return {
        "destination": "/tmp/test",
        "v8_git": "/tmp/v8",
        "oldest_version": (8, 6),
        "branches": ["main", "10.0-lkgr"]
    }


@pytest.fixture
def mock_path_exists():
    """Mock Path.exists() method for testing file system operations."""
    with patch.object(Path, 'exists') as mock_exists:
        mock_exists.return_value = True
        yield mock_exists


@pytest.fixture
def mock_file_operations():
    """Mock file read/write operations."""
    mock_data = {}
    
    def mock_read_text(self):
        return mock_data.get(str(self), "")
    
    def mock_write_text(self, content):
        mock_data[str(self)] = content
    
    with patch.object(Path, 'read_text', mock_read_text), \
         patch.object(Path, 'write_text', mock_write_text):
        yield mock_data


@pytest.fixture
def mock_environment():
    """Mock environment variables for testing."""
    original_env = os.environ.copy()
    test_env = {
        "HOME": "/tmp/test_home",
        "PATH": "/usr/bin:/bin",
        "PYTHONPATH": "/tmp/test_python"
    }
    os.environ.update(test_env)
    yield test_env
    os.environ.clear()
    os.environ.update(original_env)


@pytest.fixture
def capture_output():
    """Capture stdout/stderr for testing print statements."""
    import sys
    from io import StringIO
    
    old_stdout = sys.stdout
    old_stderr = sys.stderr
    stdout_capture = StringIO()
    stderr_capture = StringIO()
    
    sys.stdout = stdout_capture
    sys.stderr = stderr_capture
    
    yield stdout_capture, stderr_capture
    
    sys.stdout = old_stdout
    sys.stderr = old_stderr


@pytest.fixture
def mock_network():
    """Mock network requests for testing."""
    with patch('urllib.request.urlopen') as mock_urlopen:
        mock_response = Mock()
        mock_response.read.return_value = b'{"status": "ok"}'
        mock_urlopen.return_value.__enter__.return_value = mock_response
        yield mock_urlopen


@pytest.fixture(autouse=True)
def cleanup_test_files():
    """Automatically clean up any test files after each test."""
    yield
    # Clean up any test files that might have been created
    test_patterns = [
        "*.tmp",
        "test_*.log"
    ]
    for pattern in test_patterns:
        for file_path in Path.cwd().glob(pattern):
            try:
                if file_path.is_file():
                    file_path.unlink()
                elif file_path.is_dir():
                    shutil.rmtree(file_path)
            except (OSError, PermissionError):
                pass  # Ignore cleanup failures


@pytest.fixture
def mock_logger():
    """Mock logger for testing logging functionality."""
    logger = Mock()
    logger.info = Mock()
    logger.error = Mock()
    logger.warning = Mock()
    logger.debug = Mock()
    return logger