# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

import base64
import os
import unittest
from Deployment.cloud.server import (
    save_uploaded_file,
    get_uploaded_file,
    sanitize_filename,
    _FILE_REGISTRY,
    BROWSER_ALLOWED_METHODS,
)

class TestFileOperations(unittest.TestCase):
    def test_sanitize_filename(self):
        self.assertEqual(sanitize_filename("../../../etc/passwd"), "passwd")
        self.assertEqual(sanitize_filename("data;malicious.csv"), "data_malicious.csv")
        self.assertEqual(sanitize_filename("my test script.py"), "my test script.py")
        self.assertEqual(sanitize_filename(""), "uploaded_file.bin")

    def test_save_and_get_text_file(self):
        content = "col1,col2\n10,20\n30,40"
        meta = save_uploaded_file("metrics.csv", content, "text/csv")
        self.assertTrue(meta["fileId"].startswith("file-"))
        self.assertEqual(meta["filename"], "metrics.csv")
        self.assertEqual(meta["mimeType"], "text/csv")
        self.assertEqual(meta["size"], len(content.encode("utf-8")))
        self.assertTrue(meta["hasText"])
        self.assertTrue("metrics.csv" in meta["downloadUrl"] or meta["fileId"] in meta["downloadUrl"])

        fetched_meta, fetched_bytes = get_uploaded_file(meta["fileId"])
        self.assertIsNotNone(fetched_meta)
        self.assertEqual(fetched_bytes, content.encode("utf-8"))

    def test_save_and_get_base64_file(self):
        raw = b"\x89PNG\r\n\x1a\nfake-image-bytes"
        b64 = base64.b64encode(raw).decode("ascii")
        data_uri = f"data:image/png;base64,{b64}"

        meta = save_uploaded_file("icon.png", data_uri, "image/png")
        self.assertEqual(meta["filename"], "icon.png")
        self.assertEqual(meta["mimeType"], "image/png")
        self.assertEqual(meta["size"], len(raw))

        fetched_meta, fetched_bytes = get_uploaded_file(meta["fileId"])
        self.assertIsNotNone(fetched_meta)
        self.assertEqual(fetched_bytes, raw)

    def test_allowed_methods_include_files(self):
        self.assertIn("UploadFile", BROWSER_ALLOWED_METHODS)
        self.assertIn("DownloadFile", BROWSER_ALLOWED_METHODS)
        self.assertIn("ListFiles", BROWSER_ALLOWED_METHODS)

if __name__ == "__main__":
    unittest.main()
