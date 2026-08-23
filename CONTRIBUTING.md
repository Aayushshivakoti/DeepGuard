# Contributing to DeepGuard

Thank you for choosing to contribute to DeepGuard! Here are guidelines to get started:

## Development Environment Setup
1. Clone the repository
2. Install Python dependencies in a virtual environment:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. Set up frontend Vite dependencies:
   ```bash
   npm install
   ```

## Coding Conventions
- All Python code must be formatted using Black / Ruff guidelines.
- Commit messages should follow conventional commits structure (e.g. `feat(scan): ...`, `fix(auth): ...`).

## Pull Request Guidelines
- Ensure all unit tests pass:
   ```bash
   cd backend
   pytest
   ```
- Include clear details on manual verification performed.
