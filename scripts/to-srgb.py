#!/usr/bin/env python3
"""Paper exports PNGs tagged with an ICC profile (Display P3). Convert to plain sRGB so the
pixel diff compares colours, not encodings. Usage: to-srgb.py in.png out.png"""
import io, sys
from PIL import Image, ImageCms

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src)
icc = im.info.get('icc_profile')
if icc:
    prof = ImageCms.ImageCmsProfile(io.BytesIO(icc))
    print(f'{src}: {ImageCms.getProfileDescription(prof).strip()} → sRGB')
    alpha = im.getchannel('A') if im.mode == 'RGBA' else None
    rgb = ImageCms.profileToProfile(im.convert('RGB'), prof, ImageCms.createProfile('sRGB'),
                                    renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC, outputMode='RGB')
    if alpha: rgb.putalpha(alpha)
    im = rgb
im.save(dst)
