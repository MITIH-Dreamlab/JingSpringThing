#!/bin/bash

# Function to print the file structure and contents
print_file_structure() {
    local directory="$1"
    local indent="$2"

    for file in "$directory"/*; do
        if [ -d "$file" ]; then
            echo "${indent}Directory: ${file}"
            print_file_structure "$file" "  $indent"
        else
            echo "${indent}File: ${file}"
            echo "=========================="
            cat "$file"
            echo "=========================="
            echo
        fi
    done
}

# Start printing from the current directory
print_file_structure "." ""

