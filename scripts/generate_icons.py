import os
from PIL import Image, ImageOps

def create_icons():
    source_path = 'public/LogoCrispyBueno.png'
    if not os.path.exists(source_path):
        source_path = 'public/assets/LogoCrispy.png'

    print(f"Using source logo: {source_path}")
    base_img = Image.open(source_path).convert('RGBA')

    # Find tight bounding box of alpha channel > 10
    r, g, b, a = base_img.split()
    mask = a.point(lambda p: 255 if p > 10 else 0)
    bbox = mask.getbbox()
    if bbox:
        cropped_logo = base_img.crop(bbox)
    else:
        cropped_logo = base_img

    logo_w, logo_h = cropped_logo.size
    print(f"Cropped logo size: {logo_w}x{logo_h}")

    # Helper function to place logo centered on canvas
    def make_icon(canvas_size, scale_ratio=0.85, bg_color=(255, 255, 255, 0), is_maskable=False):
        # canvas_size: int (e.g. 192, 512, 180)
        canvas = Image.new('RGBA', (canvas_size, canvas_size), bg_color)
        
        # Determine max allowed dimensions for logo
        if is_maskable:
            # Maskable safe zone is inner 80% circle, so fit within 74% to be safe & nicely sized
            max_size = int(canvas_size * 0.74)
        else:
            max_size = int(canvas_size * scale_ratio)

        # Scale logo maintaining aspect ratio
        ratio = min(max_size / logo_w, max_size / logo_h)
        new_w = max(1, int(logo_w * ratio))
        new_h = max(1, int(logo_h * ratio))

        resized_logo = cropped_logo.resize((new_w, new_h), Image.Resampling.LANCZOS)

        # Center on canvas
        pos_x = (canvas_size - new_w) // 2
        pos_y = (canvas_size - new_h) // 2

        canvas.paste(resized_logo, (pos_x, pos_y), resized_logo)
        return canvas

    # Destination directory
    pub_dir = 'public'

    # 1. Standard PWA Icons (Transparent background, filling ~85% canvas)
    icon_192 = make_icon(192, scale_ratio=0.85, bg_color=(0, 0, 0, 0))
    icon_192.save(os.path.join(pub_dir, 'pwa-192.png'), 'PNG')
    icon_192.save(os.path.join(pub_dir, 'pwa-192x192.png'), 'PNG')
    icon_192.save(os.path.join(pub_dir, 'android-chrome-192x192.png'), 'PNG')

    icon_512 = make_icon(512, scale_ratio=0.85, bg_color=(0, 0, 0, 0))
    icon_512.save(os.path.join(pub_dir, 'pwa-512.png'), 'PNG')
    icon_512.save(os.path.join(pub_dir, 'pwa-512x512.png'), 'PNG')
    icon_512.save(os.path.join(pub_dir, 'android-chrome-512x512.png'), 'PNG')

    # 2. Maskable Android Icons (White solid background with 74% logo fitting inside safe zone)
    # Maskable White background version
    maskable_192_w = make_icon(192, bg_color=(255, 255, 255, 255), is_maskable=True)
    maskable_192_w.save(os.path.join(pub_dir, 'pwa-maskable-192.png'), 'PNG')
    maskable_192_w.save(os.path.join(pub_dir, 'maskable-icon-192x192.png'), 'PNG')

    maskable_512_w = make_icon(512, bg_color=(255, 255, 255, 255), is_maskable=True)
    maskable_512_w.save(os.path.join(pub_dir, 'pwa-maskable-512.png'), 'PNG')
    maskable_512_w.save(os.path.join(pub_dir, 'maskable-icon-512x512.png'), 'PNG')

    # 3. Apple Touch Icon (180x180 px - Solid white background with crisp centered logo)
    apple_icon = make_icon(180, scale_ratio=0.82, bg_color=(255, 255, 255, 255))
    apple_icon.save(os.path.join(pub_dir, 'apple-touch-icon.png'), 'PNG')

    # 4. Favicons (16x16, 32x32, 48x48, favicon.ico)
    fav_16 = make_icon(16, scale_ratio=0.92, bg_color=(0, 0, 0, 0))
    fav_16.save(os.path.join(pub_dir, 'favicon-16x16.png'), 'PNG')

    fav_32 = make_icon(32, scale_ratio=0.92, bg_color=(0, 0, 0, 0))
    fav_32.save(os.path.join(pub_dir, 'favicon-32x32.png'), 'PNG')

    fav_48 = make_icon(48, scale_ratio=0.92, bg_color=(0, 0, 0, 0))
    fav_48.save(os.path.join(pub_dir, 'favicon-48x48.png'), 'PNG')

    # Save multi-size favicon.ico
    fav_48_rgb = Image.new('RGBA', (48, 48), (255, 255, 255, 0))
    fav_48_rgb.paste(fav_48, (0, 0), fav_48)
    fav_48_rgb.save(
        os.path.join(pub_dir, 'favicon.ico'),
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48)]
    )

    print("All professional icon resources generated successfully!")

if __name__ == '__main__':
    create_icons()
