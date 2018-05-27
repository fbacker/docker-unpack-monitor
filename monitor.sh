#!/bin/bash

# Exit on first non-zero exit code like a sane language.
set -e

echo "Looking for files to unpack";
declare -ga fixed

files="$(find -L "/watch" -type f)"
echo "Count: $(echo -n "$files" | wc -l)"
echo "$files" | while read file; do
    if [ ${file: -4} == ".rar" ]
    then
        path=$(dirname "${file}")
        filename=$(basename "${file}")
        echo "lets unpack file; $file, filename $filename, path $path"
        fixed=("${fixed[@]}" "${file}")
        unrar x -o+y "${file}" "${path}"
    fi
done 


echo "Now we are ready to listen on changes";
echo "the base list: ${fixed[@]}"
#BUG list is empty!!
inotifywait --monitor --recursive -e moved_to -e create -e modify /watch |
    while read path action file; do
        
        if [ ${file: -4} == ".rar" ]
        then
            echo "The file '$file' appeared in directory '$path' via '$action'"
            echo "the list:" 
            echo ${fixed[@]}
            filepath=$path$file
            if [[ ! -z $(printf '%s\n' "${fixed[@]}" | grep -w "${filepath}") ]]; then
                # is already parsed
                echo "do nothing to, already unpacked '$filepath'"
            else 
                echo "unpack '$filepath', just sleep first so all files have a change to land."
                fixed=("${fixed[@]}" "${filepath}")
                sleep 60
                unrar x -o+y "${filepath}" "${path}"
            fi
            
        fi
    done
