"""Extract only photographic regions from the existing PNG designs."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'designs/ui'
target = root / 'public/images/memories'
target.mkdir(parents=True, exist_ok=True)
regions = {
    'graduation': ('05-沉浸式播放页.png', (107, 1200, 242, 1331)),
    'travel': ('08-我的音乐记忆页.png', (84, 702, 332, 875)),
    'cat': ('08-我的音乐记忆页.png', (84, 1005, 332, 1178)),
    'garden': ('08-我的音乐记忆页.png', (84, 1315, 332, 1488)),
    'sunset': ('01-首页-音乐相册.png', (284, 344, 607, 620)),
    'vinyl': ('02-创建音乐相册-上传照片.png', (535, 586, 625, 746)),
    'graduation-wide': ('06-调整音乐-Agent对话页.png', (128, 681, 739, 1125)),
    'graduation-backdrop': ('05-沉浸式播放页.png', (44, 224, 818, 981)),
}
for name, (filename, box) in regions.items():
    image = Image.open(source / filename).convert('RGB')
    image.crop(box).save(target / f'{name}.webp', quality=95)
    print(name, image.size, box)
