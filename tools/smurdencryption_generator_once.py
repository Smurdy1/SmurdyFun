from PIL import Image, ImageDraw, ImageFont
import math

LETTER_MAP = {chr(ord("A") + i): i + 1 for i in range(26)}

def five_bits(n):
    return [(n >> shift) & 1 for shift in (4, 3, 2, 1, 0)]

def letter_to_bits(ch):
    return five_bits(LETTER_MAP[ch.upper()])

def tokenize(text):
    tokens = []
    for ch in text:
        if ch.isalpha():
            tokens.append(("letter", ch))
        elif ch in [" ", ".", ",", "'"]:
            tokens.append(("sep", ch))
    return tokens

def separator_kind(ch):
    return {" ": "space", ".": "period", ",": "comma", "'": "apostrophe"}[ch]

def pack_text(text):
    tokens = tokenize(text)
    i = 0
    blocks = []
    while i < len(tokens):
        while i < len(tokens) and tokens[i][0] == "sep":
            i += 1
        if i >= len(tokens):
            break
        letters, caps, markers = [], [], []
        while i < len(tokens):
            ttype, val = tokens[i]
            if ttype == "letter":
                if len(letters) < 5:
                    letters.append(val.upper())
                    caps.append(val.isupper())
                    i += 1
                else:
                    break
            else:
                if letters:
                    markers.append((separator_kind(val), len(letters)))
                i += 1
        blocks.append({"letters": letters, "caps": caps, "markers": markers})
    return blocks

def encode_block_letters(block):
    bits = []
    for idx in range(5):
        bits.extend(letter_to_bits(block["letters"][idx]) if idx < len(block["letters"]) else [0, 0, 0, 0, 0])
    return bits

def encode_block_caps(block):
    caps = [False] * 5
    for i, v in enumerate(block["caps"][:5]): caps[i] = bool(v)
    return [1 if x else 0 for x in caps]

def _line(draw, p1, p2, width): draw.line([p1, p2], fill=0, width=width, joint="curve")

def _disk(draw, c, r):
    x, y = c
    draw.ellipse((x-r, y-r, x+r, y+r), fill=0)

def _seg(draw, p1, p2, width, cap=True):
    _line(draw, p1, p2, width)
    if cap:
        r = width / 2.05
        _disk(draw, p1, r)
        _disk(draw, p2, r)

def _arc(draw, box, start_deg, end_deg, width):
    x0, y0, x1, y1 = box
    for d in range(-max(1, width // 2) + 1, max(1, width // 2)):
        draw.arc((x0+d, y0+d, x1-d, y1-d), start_deg, end_deg, fill=0, width=1)

def draw_base_block(draw, origin, cell=56, stroke=11, dot_r=12, bits=None):
    if bits is None: bits = [0] * 25
    ox, oy = origin; u = cell
    p = {"tl":(ox,oy),"tm":(ox+u,oy),"tr":(ox+2*u,oy),"ml":(ox,oy+u),"c":(ox+u,oy+u),"mr":(ox+2*u,oy+u),"bl":(ox,oy+2*u),"bm":(ox+u,oy+2*u),"br":(ox+2*u,oy+2*u),"qtl":(ox+.5*u,oy+.5*u),"qtr":(ox+1.5*u,oy+.5*u),"qbl":(ox+.5*u,oy+1.5*u),"qbr":(ox+1.5*u,oy+1.5*u)}
    groups = [bits[i*5:(i+1)*5] for i in range(5)]
    specs = [
        [("bl","bm"),("ml","bl"),("bl","c"),("ml","bm"),"qbl"],
        [("tl","ml"),("tl","tm"),("tl","c"),("ml","tm"),"qtl"],
        [("tm","tr"),("tr","mr"),("tr","c"),("tm","mr"),"qtr"],
        [("mr","br"),("bm","br"),("br","c"),("bm","mr"),"qbr"],
        [("ml","c"),("tm","c"),("c","mr"),("c","bm"),"c"]]
    for gi, g in enumerate(groups):
        for bi, bit in enumerate(g):
            if not bit: continue
            spec = specs[gi][bi]
            if bi == 4: _disk(draw, p[spec], dot_r if gi < 4 else dot_r * 1.06)
            else: _seg(draw, p[spec[0]], p[spec[1]], stroke)

def draw_caps(draw, origin, cap_bits, cell=56, stroke=10, dot_r=10):
    if not any(cap_bits): return
    ox, oy = origin; u = cell; apex = (ox-.84*u, oy+u)
    if cap_bits[0]: _seg(draw, apex, (ox,oy), stroke)
    if cap_bits[1]: _seg(draw, apex, (ox,oy+2*u), stroke)
    if cap_bits[2]: _seg(draw, apex, (ox,oy+u), stroke)
    if cap_bits[3]: _disk(draw, (ox-.42*u,oy+.5*u), dot_r)
    if cap_bits[4]: _disk(draw, (ox-.42*u,oy+1.5*u), dot_r)

def draw_separator(draw, origin, kind, pos, size=54, stroke=9):
    x, y = origin; cx = x + size*.5
    total_h = size*1.95; top = y+size*.02; shoulder_y = y+size*.50; stem_bottom = y+total_h
    stem_dx = size*.23; xs = {"l":cx-stem_dx,"c":cx,"r":cx+stem_dx}; half_w = size*.33; left = cx-half_w; right = cx+half_w; apex=(cx,top)
    if kind == "space":
        radius=size*.31; cy=y+size*.35; draw.ellipse((cx-radius,cy-radius,cx+radius,cy+radius), outline=0, width=stroke); stem_top=cy+radius
    elif kind == "period":
        _seg(draw,(left,shoulder_y),apex,stroke); _seg(draw,apex,(right,shoulder_y),stroke); _seg(draw,(left,shoulder_y),(right,shoulder_y),stroke); stem_top=shoulder_y
    elif kind == "comma":
        _seg(draw,(left,shoulder_y),apex,stroke); _seg(draw,apex,(right,shoulder_y),stroke); stem_top=shoulder_y
    elif kind == "apostrophe":
        bar_y=y+size*.28; _seg(draw,(left,bar_y),(right,bar_y),stroke); stem_top=bar_y
    else: raise ValueError(kind)
    patterns={1:("c",),2:("l",),3:("l","c"),4:("l","r"),5:("l","c","r")}
    for which in patterns[pos]: _seg(draw,(xs[which],stem_top),(xs[which],stem_bottom),stroke)

def draw_version_marker(draw, origin, finished=True, height=58, stroke=9):
    x,y=origin; h=height; w=h*.58
    _seg(draw,(x,y),(x,y+h),stroke); _seg(draw,(x,y),(x+.43*w,y),stroke); _seg(draw,(x,y+h),(x+.43*w,y+h),stroke)
    _arc(draw,(x+.05*w,y,x+1.05*w,y+h),-90,90,stroke)
    _seg(draw,(x+.42*w,y),(x+.64*w,y),stroke); _seg(draw,(x+.42*w,y+h),(x+.64*w,y+h),stroke)
    if finished: _seg(draw,(x+.06*w,y+h/2),(x+.76*w,y+h/2),max(4,stroke-2))

def _layout_values(block_cell, marker_count):
    plain_gap=block_cell*.44; lead_gap=block_cell*.38; marker_step=block_cell*.98; tail_gap=block_cell*.44
    if marker_count <= 0: return {"width":int(block_cell*2+plain_gap),"lead_gap":lead_gap,"marker_step":marker_step,"tail_gap":tail_gap}
    cluster_width=marker_step*max(0,marker_count-1)+block_cell*.66
    return {"width":int(block_cell*2+lead_gap+cluster_width+tail_gap),"lead_gap":lead_gap,"marker_step":marker_step,"tail_gap":tail_gap}

def _render_text_internal(text, finished=True, max_blocks_per_row=4, block_cell=56, margin=36, label=None):
    blocks=pack_text(text); stroke=max(6,int(block_cell*.19)); dot_r=max(8,int(block_cell*.205)); sep_size=int(block_cell*.94); row_gap=int(block_cell*.62); block_gap=int(block_cell*.08)
    rows=[]; cur=[]
    for b in blocks:
        cur.append(b)
        if len(cur)>=max_blocks_per_row: rows.append(cur); cur=[]
    if cur: rows.append(cur)
    if not rows: rows=[[]]
    label_extra=44 if label else 0; top_extra=56; block_height=int(block_cell*2)
    row_widths=[max(sum(_layout_values(block_cell,len(b.get("markers",[])))["width"]+block_gap for b in row),1) for row in rows]
    d_slot=int(block_cell*.98); d_to_block_gap=int(block_cell*.72)
    width=max(520,margin*2+d_slot+d_to_block_gap+max(row_widths)); height=margin*2+label_extra+top_extra+len(rows)*block_height+max(0,len(rows)-1)*row_gap+24
    img=Image.new("L",(width,height),255); draw=ImageDraw.Draw(img)
    try: label_font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",28)
    except: label_font=ImageFont.load_default()
    if label: draw.text((margin,margin-4),label,fill=0,font=label_font)
    start_x=margin+d_slot+d_to_block_gap; start_y=margin+label_extra+top_extra
    version_h=int(block_cell*1.02); version_y=start_y+int((block_cell*2-version_h)/2)
    draw_version_marker(draw,(margin,version_y),finished=finished,height=version_h,stroke=max(5,stroke-2))
    for row_idx,row in enumerate(rows):
        x=start_x; y=start_y+row_idx*(block_height+row_gap)
        for block in row:
            draw_base_block(draw,(x,y),cell=block_cell,stroke=stroke,dot_r=dot_r,bits=encode_block_letters(block))
            draw_caps(draw,(x,y),encode_block_caps(block),cell=block_cell,stroke=max(5,stroke-1),dot_r=max(7,dot_r-2))
            layout=_layout_values(block_cell,len(block.get("markers",[]))); marker_start_x=x+int(block_cell*2+layout["lead_gap"])
            for j,(kind,pos) in enumerate(block.get("markers",[])):
                draw_separator(draw,(int(marker_start_x+j*layout["marker_step"]),y),kind,pos,size=sep_size,stroke=max(4,stroke-2))
            x += layout["width"]+block_gap
    return img

def render_text(text, finished=True, max_blocks_per_row=4, block_cell=56, margin=36, label=None, aa_scale=6):
    big=_render_text_internal(text,finished,max_blocks_per_row,block_cell*aa_scale,margin*aa_scale,label)
    small=big.resize((big.width//aa_scale,big.height//aa_scale),Image.Resampling.LANCZOS)
    out=Image.new("RGB",small.size,"white"); out.paste(Image.merge("RGB",(small,small,small))); return out

if __name__ == "__main__":
    import sys
    text = sys.argv[1] if len(sys.argv) > 1 else "OCVLVS SMVRDII OMNIA VIDET"
    output = sys.argv[2] if len(sys.argv) > 2 else "assets/lore/smurdencryption.png"
    render_text(text, finished=True, max_blocks_per_row=4, block_cell=56, label=None).save(output)
