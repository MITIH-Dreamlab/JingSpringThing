#!/bin/bash

# Function to recursively list and print files
print_files() {
    local dir="$1"

    for file in "$dir"/*; do
        if [ -f "$file" ] && [ "$(basename "$file")" != ".env" ]; then
            echo "# $file"
            cat "$file"
            echo -e "\n"
        elif [ -d "$file" ]; then
            print_files "$file"
        fi
    done
}

# Starting point for current directory
print_files "."

