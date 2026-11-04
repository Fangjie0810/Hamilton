#!/usr/bin/env python3
"""Offline metadata, decode check, and contact sheets for generated originals."""
import argparse
import json
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw

FFMPEG = '/Applications/VideoFusion-macOS.app/Contents/Resources/ffmpeg'
FFPROBE = '/Applications/TRAE SOLO CN.app/Contents/Resources/app/bin/ffprobe'

def main():
    p = argparse.ArgumentParser()
    p.add_argument('video', type=Path)
    p.add_argument('--id', required=True)
    p.add_argument('--out', type=Path, required=True)
    args = p.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    info = json.loads(subprocess.check_output([FFPROBE, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(args.video)]))
    # Keep metadata useful for review; no provider signed download URLs are read.
    (args.out/'probe.json').write_text(json.dumps(info, indent=2)+'\n')
    decoded = subprocess.run([FFMPEG, '-hide_banner', '-v', 'error', '-xerror', '-i', str(args.video), '-map', '0:v:0', '-an', '-f', 'null', '-'], capture_output=True, text=True)
    (args.out/'decode.log').write_text(decoded.stderr)
    if decoded.returncode:
        raise SystemExit('Decode failed; inspect local decode.log')
    frames = args.out/'frames'; frames.mkdir(exist_ok=True)
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(args.video), '-an', '-vf', 'fps=1,scale=480:-2', '-c:v', 'png', str(frames/'%03d.png')], check=True)
    files = sorted(frames.glob('*.png'))
    for page in range((len(files)+14)//15):
        sheet = Image.new('RGB', (1440, 5*300), '#202722')
        draw = ImageDraw.Draw(sheet)
        for slot, f in enumerate(files[page*15:(page+1)*15]):
            i=page*15+slot; x=slot%3*480; y=slot//3*300
            with Image.open(f) as im: sheet.paste(im.convert('RGB'), (x,y+26))
            draw.text((x+10,y+7), f'{args.id} / sample approx. {i+0.5:04.1f}s', fill='white')
        sheet.save(args.out/f'contact-{page+1}.jpg', quality=90)
    v = next(s for s in info['streams'] if s['codec_type']=='video')
    report = dict(id=args.id, video=str(args.video.resolve()), decode='passed', width=v['width'],height=v['height'],codec=v['codec_name'],pixel_format=v.get('pix_fmt'),fps=v.get('avg_frame_rate'),duration=info['format'].get('duration'),audio_tracks=sum(s['codec_type']=='audio' for s in info['streams']),samples=len(files))
    (args.out/'technical-check.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))

if __name__=='__main__': main()
