"""
Data Fetcher
This module contains functions to fetch Logseq data from GitHub and process it.
"""

import os
import requests
from zipfile import ZipFile

def fetch_logseq_data_from_github(github_repo_url: str, local_extract_path: str):
    """
    Fetch Logseq data from a GitHub repository and extract it to a local path.

    Args:
        github_repo_url (str): URL to the GitHub repository.
        local_extract_path (str): Local path to extract the data.
    """
    response = requests.get(github_repo_url, stream=True)
    with open('logseq_graph.zip', 'wb') as out_file:
        for chunk in response.iter_content(chunk_size=128):
            out_file.write(chunk)
            
    with ZipFile('logseq_graph.zip', 'r') as zip_ref:
        zip_ref.extractall(local_extract_path)
