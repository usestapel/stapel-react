#!/usr/bin/env bash
# Regenerates packages/recordings-react/test/fixtures/upload/* (ffmpeg).
set -euo pipefail
cd "$1"
A='aevalsrc=0.4*sin(2*PI*(180+60*sin(2*PI*3*t))*t)*(0.6+0.4*sin(2*PI*4*t)):s=16000:d=3'
V='testsrc=size=96x64:rate=10:d=3'
F=(ffmpeg -loglevel error -y)
ENC=(-c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -b:a 24k -ac 1)
"${F[@]}" -f lavfi -i "$V" -f lavfi -i "$A" "${ENC[@]}" av.mp4
"${F[@]}" -f lavfi -i "$V" -f lavfi -i "$A" "${ENC[@]}" -movflags +faststart av-faststart.m4v
"${F[@]}" -f lavfi -i "$V" -f lavfi -i "$A" "${ENC[@]}" av.mov
"${F[@]}" -f lavfi -i "$V" -itsoffset 0.5 -f lavfi -i "$A" -map 0:v -map 1:a "${ENC[@]}" -use_editlist 1 editlist.mp4
"${F[@]}" -f lavfi -i "$V" -f lavfi -i "$A" "${ENC[@]}" -movflags frag_keyframe+empty_moov fragmented.mp4
"${F[@]}" -f lavfi -i "$V" -c:v libx264 -preset ultrafast -pix_fmt yuv420p video-only.mp4
"${F[@]}" -f lavfi -i "$V" -f lavfi -i "$A" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a libopus -b:a 16k opus.mp4
"${F[@]}" -f lavfi -i "$V" -f lavfi -i "$A" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a pcm_s16le pcm.mov
# Two audio tracks: stereo 44.1 kHz (eng) and 5.1 48 kHz (rus, named).
"${F[@]}" -f lavfi -i "$V" -f lavfi -i "$A" -f lavfi -i "sine=f=330:r=48000:d=3" \
  -map 0:v -map 1:a -map 2:a -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -b:a 64k \
  -filter:a:0 aresample=44100 -ac:a:0 2 -ac:a:1 6 \
  -metadata:s:a:0 language=eng -metadata:s:a:1 language=rus -metadata:s:a:1 handler_name=Commentary multi.mp4
