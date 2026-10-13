"""Draw spec/intended.json and spec/from_source.json as state graphs into previews/."""
import json
import pathlib
import re
import textwrap

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import networkx as nx

root = pathlib.Path(__file__).parent.parent
out = root / "previews"


def wrap(s, n=26):
    return "\n".join(textwrap.wrap(str(s), n)) or str(s)


def draw(title, edges, path, colour):
    """edges: (from, event, to). Self-loops are listed under the node instead of drawn."""
    g = nx.DiGraph()
    loops = {}
    for a, ev, b in edges:
        g.add_node(a)
        g.add_node(b)
        if a == b:
            loops.setdefault(a, []).append(ev)
        elif g.has_edge(a, b):
            g[a][b]["label"] += "\n" + wrap(ev, 30)
        else:
            g.add_edge(a, b, label=wrap(ev, 30))
    n = max(len(g), 2)
    fig, ax = plt.subplots(figsize=(max(11, n * 2.6), max(8, n * 1.9)))
    pos = nx.circular_layout(g, scale=3)
    nx.draw_networkx_nodes(g, pos, ax=ax, node_color=colour, node_size=5200, edgecolors="#333")
    nx.draw_networkx_edges(g, pos, ax=ax, arrowsize=18, node_size=5200,
                           connectionstyle="arc3,rad=0.16", edge_color="#555")
    for node, (x, y) in pos.items():
        ax.text(x, y, wrap(node, 16), ha="center", va="center", fontsize=8, weight="bold")
        if node in loops:
            txt = "stays here on:\n" + "\n".join("· " + wrap(e, 34).replace("\n", "\n  ") for e in loops[node][:5])
            if len(loops[node]) > 5:
                txt += f"\n· (+{len(loops[node]) - 5} more)"
            ax.text(x * 1.62, y * 1.5, txt, ha="center", va="center", fontsize=6, color="#444",
                    bbox=dict(boxstyle="round", fc="#f6f6f6", ec="#ccc"))
    nx.draw_networkx_edge_labels(g, pos, ax=ax, font_size=6, label_pos=0.32, rotate=False,
                                 edge_labels=nx.get_edge_attributes(g, "label"),
                                 connectionstyle="arc3,rad=0.16",
                                 bbox=dict(boxstyle="round", fc="white", ec="none", alpha=0.85))
    ax.set_title(title, fontsize=13, weight="bold")
    ax.margins(0.42)
    ax.axis("off")
    fig.savefig(path, dpi=110, bbox_inches="tight")
    plt.close(fig)
    print(path.name, len(g), "states", len(edges), "transitions")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")[:28]


intended = json.load(open(root / "spec" / "intended.json", encoding="utf-8"))
for i, c in enumerate(intended["components"]):
    edges = []
    for a, ev, b, _ in c["transitions"]:
        for src in a.split("|"):
            edges.append((src, ev, src if b == "same" else b))
    draw("INTENDED — " + c["name"], edges, out / f"09{'abc'[i]}_intended_{slug(c['name'])}.png", "#bfe3c0")

source = json.load(open(root / "spec" / "from_source.json", encoding="utf-8"))
for i, c in enumerate(source["components"]):
    label = {s["id"]: f"{s['id']} {s.get('label', '')}" for s in c["states"]}
    ev = {e["id"]: e.get("label", e["id"]) for e in c["events"]}
    edges = [(label.get(t["from"], t["from"]), ev.get(t["event"], t["event"]), label.get(t["to"], t["to"]))
             for t in c["transitions"]]
    draw("FROM SOURCE — " + c["name"], edges, out / f"10{'abcdefgh'[i]}_source_{slug(c['name'])}.png", "#bcd4f2")
