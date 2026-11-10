# Contributing

The most useful contribution is a correction with a source, or a new model row.

## Add or fix a model row

1. Open the page for the model (the Ollama library tag page or the Hugging Face model card).
2. Copy any row in `data/models.json`. Set `file_gb` to the file size on the page.
3. Set `memory_gb` to `file_gb * 1.15 + 1.0`, rounded to one decimal. `memory_basis` stays `estimate`.
4. Set `source_url` to the page you read and `read_date` to the day you read it (YYYY-MM-DD).
5. Set `licence` and `licence_source_url`. Say "not stated" for anything the page does not state. Do not guess.
6. Run `python tools/validate.py`, then `python tools/build_site.py`.
7. Run the tests: `python -m unittest discover -s tests` and `node --test tests/engine.test.js tests/card.test.js`.
8. Run `python tools/check_release.py`.

## Rules

- Every row needs a source URL and a read date. The validator fails without them.
- No prices and no products. Hardware tiers only.
- No dashes in the copy, short sentences, straight apostrophes.
- No dependencies. Python standard library and plain browser JavaScript only.

## Reporting a bug

Say which operating system, memory and goal you entered, what the page told you, and what you expected.
