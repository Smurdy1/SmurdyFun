from pathlib import Path
import re

p = Path('src/js/lore.js')
s = p.read_text()
s = s.replace('const RELEASE_VERSION = "1.16.0";', 'const RELEASE_VERSION = "1.16.1";')
for old, new in {
    '/assets/lore/turnover-reverse.svg': '/assets/lore/turnover.png',
    '/assets/lore/eye-offset.webp': '/assets/lore/eye-offset.png',
    '/assets/lore/empty-eye.webp': '/assets/lore/eye-empty.png',
    '/assets/lore/forsaken8-box.webp': '/assets/lore/cat-box.png',
    '/assets/lore/jailtime-redacted.webp': '/assets/lore/jailtime.png',
    '/assets/lore/forsaken8.webp': '/assets/lore/forsaken8.png',
    '/assets/lore/route-4824.webp': '/assets/lore/route-4824.png',
    '/assets/lore/bouvet.webp': '/assets/lore/bouvet.png',
    '/assets/lore/tps.webp': '/assets/lore/tps.png',
    '/assets/lore/overlap.webp': '/assets/lore/overlap.png',
}.items():
    s = s.replace(old, new)

share_fn = '''async function loadLoreImage(src) {
        return new Promise((resolve, reject) => {
            const image = new root.Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error("Lore image decode failed"));
            image.src = src;
        });
    }

    async function add1313ToShareImage(blob, result) {
        if (!share1313?.get(result) || !root?.document || !root?.URL || !root?.Image) return blob;
        try {
            const image = await blobImage(blob);
            const eye = await loadLoreImage("/assets/lore/eye-outline.png");
            const canvas = root.document.createElement("canvas");
            canvas.width = image.naturalWidth || image.width;
            canvas.height = image.naturalHeight || image.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) return blob;
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            const size = Math.max(28, Math.round(canvas.width * 0.045));
            const x = canvas.width - size - 34;
            const y = canvas.height - size - 28;
            ctx.save();
            ctx.globalAlpha = 0.72;
            ctx.drawImage(eye, x, y, size, size);
            ctx.fillStyle = "rgba(20,20,20,.72)";
            ctx.font = "12px ui-monospace, monospace";
            ctx.fillText("1313", x - 2, y - 5);
            ctx.restore();
            return await canvasBlob(canvas);
        } catch (_) {
            return blob;
        }
    }

    function patchCompletion()'''
s, count = re.subn(r'async function add1313ToShareImage\(blob, result\) \{.*?\n    \}\n\n    function patchCompletion\(\)', share_fn, s, flags=re.S)
if count != 1:
    raise SystemExit(f'share replacement count={count}')

archive_fn = '''function renderArchive() {
        const main = pageRoot("lore-archive");
        const title = root.document.createElement("h1");
        title.textContent = "archive";
        const list = root.document.createElement("div");
        list.className = "lore-archive-list";
        const output = root.document.createElement("div");
        output.className = "lore-archive-output";

        const files = [
            ["FILE 8-BCE", "image", "/assets/lore/forsaken8.png"],
            ["SUBJECT 121", "image", "/assets/lore/cat-dark.png"],
            ["RECOVERED 03/17", "image", "/assets/lore/eye-bars.png"],
            ["ROUTE 4824", "image", "/assets/lore/road.png"],
            ["ARCHIVE 1353", "image", "/assets/lore/smurdencryption.png"],
            ["OBSERVATION INCOMPLETE", "image", "/assets/lore/eye-batman.png"],
            ["SOURCE DISPUTED", "image", "/assets/lore/purple-shadow.jpg"],
            ["BASELINE A", "image", "/assets/lore/eye-normal-a.png"],
            ["BASELINE B", "image", "/assets/lore/eye-normal-b.png"],
            ["WINDOW RECORD", "image", "/assets/lore/cat-window.png"],
            ["STATUS: FORSAKEN", "image", "/assets/lore/tree.png"],
            ["SIGNAL LOST", "image", "/assets/lore/sign.png"],
            ["HYPER", "image", "/assets/lore/hyper-dark.png"],
            ["SINCE 1984", "image", "/assets/lore/since-1984.png"],
            ["FAN RECORD", "image", "/assets/lore/faucet-fan.png"],
            ["OBJECT 505", "image", "/assets/lore/pumpkin.png"],
            ["STRUCTURE UNCHANGED", "image", "/assets/lore/old-map.png"],
            ["EARLY ICON", "image", "/assets/lore/pixel-creature.png"],
            ["EYE / RED", "image", "/assets/lore/eye-red.png"],
            ["EYE / OUTLINE", "image", "/assets/lore/eye-outline.png"],
            ["AUDIO 5729", "audio", "/assets/lore/trombone.wav"],
            ["5729.txt", "text", "DEPREHENSVM PERFECI\\nNO FURTHER RECORD."]
        ];
        const recovered = variant("archive-recovered", files.length);
        files.forEach((file, index) => {
            const button = root.document.createElement("button");
            button.type = "button";
            button.textContent = file[0];
            button.addEventListener("click", () => {
                output.replaceChildren();
                if (index !== recovered) {
                    output.textContent = variant(`archive-dead-${index}`, 3) === 0 ? "NO FURTHER RECORD." : "";
                    return;
                }
                if (file[1] === "text") {
                    output.textContent = file[2];
                    return;
                }
                output.textContent = "RECOVERED";
                if (file[1] === "audio") {
                    const audio = root.document.createElement("audio");
                    audio.controls = true;
                    audio.preload = "none";
                    audio.src = file[2];
                    output.appendChild(audio);
                    return;
                }
                output.appendChild(artifact(file[2]));
            });
            list.appendChild(button);
        });
        main.append(title, list, output);
    }

    function renderSecretPage()'''
s, count = re.subn(r'function renderArchive\(\) \{.*?\n    \}\n\n    function renderSecretPage\(\)', archive_fn, s, flags=re.S)
if count != 1:
    raise SystemExit(f'archive replacement count={count}')
p.write_text(s)

for file in [Path('index.html'), Path('src/js/quiz_session.js'), *Path('.').glob('*/index.html')]:
    if not file.exists():
        continue
    text = file.read_text()
    text = re.sub(r'lore\.js\?v=2026091[45]-lore-[123]', 'lore.js?v=20260915-lore-3', text)
    file.write_text(text)

test = Path('tests/lore_system.test.js')
t = test.read_text()
t = t.replace('assert.equal(lore.RELEASE_VERSION, "1.16.0");', 'assert.equal(lore.RELEASE_VERSION, "1.16.1");')
t = t.replace('/\\/src\\/js\\/lore\\.js\\?v=20260914-lore-2/', '/\\/src\\/js\\/lore\\.js\\?v=20260915-lore-3/')
t += r'''

test("lore visuals are originals or generated Smurdy Encryption, never redraw SVGs", () => {
    const source = read("src/js/lore.js");
    assert.doesNotMatch(source, /assets\/lore\/[^"']+\.svg/);
    assert.doesNotMatch(source, /assets\/lore\/[^"']+\.webp/);
    const originals = [
        "eye-bars.png", "overlap.png", "cat-dark.png", "eye-normal-a.png", "eye-empty.png",
        "turnover.png", "tps.png", "tree.png", "sign.png", "forsaken8.png", "eye-batman.png",
        "jailtime.png", "cat-box.png", "hyper-dark.png", "cat-window.png", "since-1984.png",
        "faucet-fan.png", "road.png", "eye-outline.png", "route-4824.png", "bouvet.png",
        "eye-offset.png", "pumpkin.png", "old-map.png", "pixel-creature.png", "eye-red.png",
        "eye-normal-b.png", "purple-shadow.jpg"
    ];
    for (const asset of originals) {
        assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", "lore", asset)), asset);
        assert.match(source, new RegExp(asset.replace(".", "\\.")), `lore should use ${asset}`);
    }
    assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", "lore", "trombone.wav")));
    assert.match(source, /trombone\.wav/);
    assert.match(source, /audio\.preload = "none"/);
    assert.doesNotMatch(source, /autoplay/);
    assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", "lore", "smurdencryption.png")));
});
'''
test.write_text(t)
