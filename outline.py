from PIL import Image, ImageFilter
import os

files = ['ham_001.png', 'dak_001.png', 'piz_001.png', 'cap_001.png']
base_dir = r'd:\15_program development\008_air playing\air play 1_2\public'

for filename in files:
    filepath = os.path.join(base_dir, filename)
    if not os.path.exists(filepath):
        print(f"{filename} not found")
        continue
        
    try:
        img = Image.open(filepath).convert("RGBA")
        
        alpha = img.split()[3]
        
        # 3px outline
        outline_thickness = 5
        dilated = alpha.filter(ImageFilter.MaxFilter(outline_thickness * 2 + 1))
        
        # Create a solid white image and apply the dilated alpha
        outline_img = Image.new("RGB", img.size, (255, 255, 255))
        outline_img.putalpha(dilated)
        
        # Paste the original image on top
        outline_img.paste(img, (0, 0), img)
        
        outline_img.save(filepath)
        print(f"Processed {filename}")
    except Exception as e:
        print(f"Error processing {filename}: {e}")
