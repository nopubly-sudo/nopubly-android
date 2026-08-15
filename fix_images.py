from PIL import Image
import os

images = [
    '/Users/alex/nopubly_local/nopubly_windows/src/resources/wizard_large.bmp',
    '/Users/alex/nopubly_local/nopubly_windows/src/resources/wizard_small.bmp'
]

for img_path in images:
    if os.path.exists(img_path):
        try:
            im = Image.open(img_path)
            # El usuario dice que estan "boca abajo". 
            # FLIP_TOP_BOTTOM deberia arreglarlo si es un problema de inversion vertical.
            # Si es rotacion 180 grados, seria ROTATE_180.
            # Probaremos FLIP_TOP_BOTTOM asumiendo problema de BMP header o similar.
            out = im.transpose(Image.FLIP_TOP_BOTTOM)
            out.save(img_path)
            print(f"Fixed (Flip Top-Bottom): {img_path}")
        except Exception as e:
            print(f"Error processing {img_path}: {e}")
    else:
        print(f"File not found: {img_path}")
