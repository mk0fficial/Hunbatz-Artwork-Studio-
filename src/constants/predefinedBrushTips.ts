export interface PredefinedBrushTip {
  id: string;
  name: string;
  url: string;
  category:
    | "All"
    | "Splatter & Spray"
    | "Bristles & Hatching"
    | "Foliage & Nature"
    | "Watercolor & Wash"
    | "Texture & Grunge"
    | "Shapes & Stamps";
  width: number;
  height: number;
  isChromatic?: boolean;
}

export const PREDEFINED_BRUSH_TIPS: PredefinedBrushTip[] = [
  {
    "id": "krita_tip_001",
    "name": "Grunge Block Scratch",
    "url": "/assets/brush_tips/krita_tip_001.png",
    "category": "Texture & Grunge",
    "width": 96,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_002",
    "name": "Dot Orbit Cluster",
    "url": "/assets/brush_tips/krita_tip_002.png",
    "category": "Shapes & Stamps",
    "width": 97,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_003",
    "name": "Textured Mist Wash",
    "url": "/assets/brush_tips/krita_tip_003.png",
    "category": "Watercolor & Wash",
    "width": 97,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_004",
    "name": "Grass Sprout",
    "url": "/assets/brush_tips/krita_tip_004.png",
    "category": "Foliage & Nature",
    "width": 97,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_005",
    "name": "Splash Ring",
    "url": "/assets/brush_tips/krita_tip_005.png",
    "category": "Splatter & Spray",
    "width": 96,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_006",
    "name": "Wet Sponge Dab",
    "url": "/assets/brush_tips/krita_tip_006.png",
    "category": "Watercolor & Wash",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_007",
    "name": "Bamboo Leaf Frond",
    "url": "/assets/brush_tips/krita_tip_007.png",
    "category": "Foliage & Nature",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_008",
    "name": "Dot Diamond Grid",
    "url": "/assets/brush_tips/krita_tip_008.png",
    "category": "Shapes & Stamps",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_009",
    "name": "Droplet Trail",
    "url": "/assets/brush_tips/krita_tip_009.png",
    "category": "Splatter & Spray",
    "width": 96,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_010",
    "name": "Dense Ink Splatter",
    "url": "/assets/brush_tips/krita_tip_010.png",
    "category": "Splatter & Spray",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_011",
    "name": "Stipple Spray",
    "url": "/assets/brush_tips/krita_tip_011.png",
    "category": "Splatter & Spray",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_012",
    "name": "Fine Speckle Dust",
    "url": "/assets/brush_tips/krita_tip_012.png",
    "category": "Splatter & Spray",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_013",
    "name": "Scattered Ink Drops",
    "url": "/assets/brush_tips/krita_tip_013.png",
    "category": "Splatter & Spray",
    "width": 96,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_014",
    "name": "Halftone Dot Cluster",
    "url": "/assets/brush_tips/krita_tip_014.png",
    "category": "Shapes & Stamps",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_015",
    "name": "Mottled Sponge Dab",
    "url": "/assets/brush_tips/krita_tip_015.png",
    "category": "Texture & Grunge",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_016",
    "name": "Particle Swirl Streak",
    "url": "/assets/brush_tips/krita_tip_016.png",
    "category": "Splatter & Spray",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_017",
    "name": "Dual Scratch Bars",
    "url": "/assets/brush_tips/krita_tip_017.png",
    "category": "Texture & Grunge",
    "width": 96,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_018",
    "name": "Organic Leopard Mottling",
    "url": "/assets/brush_tips/krita_tip_018.png",
    "category": "Texture & Grunge",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_019",
    "name": "Cracked Grunge Flakes",
    "url": "/assets/brush_tips/krita_tip_019.png",
    "category": "Texture & Grunge",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_020",
    "name": "Feathered Wing Foliage",
    "url": "/assets/brush_tips/krita_tip_020.png",
    "category": "Foliage & Nature",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_021",
    "name": "Soft Shading Bar",
    "url": "/assets/brush_tips/krita_tip_021.png",
    "category": "Bristles & Hatching",
    "width": 96,
    "height": 95,
    "isChromatic": false
  },
  {
    "id": "krita_tip_022",
    "name": "Coarse Charcoal Bar",
    "url": "/assets/brush_tips/krita_tip_022.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 95,
    "isChromatic": false
  },
  {
    "id": "krita_tip_023",
    "name": "Bilateral Rake Spine",
    "url": "/assets/brush_tips/krita_tip_023.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 95,
    "isChromatic": false
  },
  {
    "id": "krita_tip_024",
    "name": "Comb Rake Strip",
    "url": "/assets/brush_tips/krita_tip_024.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 95,
    "isChromatic": false
  },
  {
    "id": "krita_tip_025",
    "name": "Fine Comb Rake",
    "url": "/assets/brush_tips/krita_tip_025.png",
    "category": "Bristles & Hatching",
    "width": 96,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_026",
    "name": "Circular Sponge Stamp",
    "url": "/assets/brush_tips/krita_tip_026.png",
    "category": "Texture & Grunge",
    "width": 96,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_027",
    "name": "Moss & Shrub Clump",
    "url": "/assets/brush_tips/krita_tip_027.png",
    "category": "Foliage & Nature",
    "width": 98,
    "height": 96,
    "isChromatic": true
  },
  {
    "id": "krita_tip_028",
    "name": "Liquid Splash Stream",
    "url": "/assets/brush_tips/krita_tip_028.png",
    "category": "Splatter & Spray",
    "width": 94,
    "height": 96,
    "isChromatic": true
  },
  {
    "id": "krita_tip_029",
    "name": "Cyan Droplets Trail",
    "url": "/assets/brush_tips/krita_tip_029.png",
    "category": "Splatter & Spray",
    "width": 96,
    "height": 97,
    "isChromatic": true
  },
  {
    "id": "krita_tip_030",
    "name": "Rough Charcoal Wedge",
    "url": "/assets/brush_tips/krita_tip_030.png",
    "category": "Bristles & Hatching",
    "width": 96,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_031",
    "name": "Bead Arch Cluster",
    "url": "/assets/brush_tips/krita_tip_031.png",
    "category": "Shapes & Stamps",
    "width": 98,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_032",
    "name": "Horizon Particle Spray",
    "url": "/assets/brush_tips/krita_tip_032.png",
    "category": "Splatter & Spray",
    "width": 94,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_033",
    "name": "Soft Bokeh Spheres",
    "url": "/assets/brush_tips/krita_tip_033.png",
    "category": "Shapes & Stamps",
    "width": 96,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_034",
    "name": "Rough Mortar Brickwork",
    "url": "/assets/brush_tips/krita_tip_034.png",
    "category": "Texture & Grunge",
    "width": 96,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_035",
    "name": "Lens Starburst Flare",
    "url": "/assets/brush_tips/krita_tip_035.png",
    "category": "Shapes & Stamps",
    "width": 98,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_036",
    "name": "Linear Falloff Gradient",
    "url": "/assets/brush_tips/krita_tip_036.png",
    "category": "Shapes & Stamps",
    "width": 94,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_037",
    "name": "Pastel Chalk Stroke",
    "url": "/assets/brush_tips/krita_tip_037.png",
    "category": "Bristles & Hatching",
    "width": 96,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_038",
    "name": "Hair Strand Sweep",
    "url": "/assets/brush_tips/krita_tip_038.png",
    "category": "Bristles & Hatching",
    "width": 96,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_039",
    "name": "Dense Prairie Grass",
    "url": "/assets/brush_tips/krita_tip_039.png",
    "category": "Foliage & Nature",
    "width": 98,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_040",
    "name": "Stipple Grain Cluster",
    "url": "/assets/brush_tips/krita_tip_040.png",
    "category": "Splatter & Spray",
    "width": 94,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_041",
    "name": "Bold Heart Stamp",
    "url": "/assets/brush_tips/krita_tip_041.png",
    "category": "Shapes & Stamps",
    "width": 96,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_042",
    "name": "Botanical Herb Branch",
    "url": "/assets/brush_tips/krita_tip_042.png",
    "category": "Foliage & Nature",
    "width": 96,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_043",
    "name": "Falling Autumn Leaves",
    "url": "/assets/brush_tips/krita_tip_043.png",
    "category": "Foliage & Nature",
    "width": 98,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_044",
    "name": "Floating Rock Shelf",
    "url": "/assets/brush_tips/krita_tip_044.png",
    "category": "Foliage & Nature",
    "width": 94,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_045",
    "name": "Alpine Mountain Peak",
    "url": "/assets/brush_tips/krita_tip_045.png",
    "category": "Foliage & Nature",
    "width": 96,
    "height": 94,
    "isChromatic": false
  },
  {
    "id": "krita_tip_046",
    "name": "Pinecone Spire Tip",
    "url": "/assets/brush_tips/krita_tip_046.png",
    "category": "Foliage & Nature",
    "width": 96,
    "height": 94,
    "isChromatic": false
  },
  {
    "id": "krita_tip_047",
    "name": "Soft Shaded Diamond",
    "url": "/assets/brush_tips/krita_tip_047.png",
    "category": "Shapes & Stamps",
    "width": 98,
    "height": 94,
    "isChromatic": false
  },
  {
    "id": "krita_tip_048",
    "name": "Loose Scribble Hatching",
    "url": "/assets/brush_tips/krita_tip_048.png",
    "category": "Bristles & Hatching",
    "width": 94,
    "height": 94,
    "isChromatic": false
  },
  {
    "id": "krita_tip_049",
    "name": "Dynamic Ink Splash",
    "url": "/assets/brush_tips/krita_tip_049.png",
    "category": "Splatter & Spray",
    "width": 96,
    "height": 92,
    "isChromatic": false
  },
  {
    "id": "krita_tip_050",
    "name": "Dense Comb Rake",
    "url": "/assets/brush_tips/krita_tip_050.png",
    "category": "Bristles & Hatching",
    "width": 96,
    "height": 92,
    "isChromatic": false
  },
  {
    "id": "krita_tip_051",
    "name": "Bead Chain Trail",
    "url": "/assets/brush_tips/krita_tip_051.png",
    "category": "Shapes & Stamps",
    "width": 97,
    "height": 92,
    "isChromatic": false
  },
  {
    "id": "krita_tip_052",
    "name": "Blurred Dot Gradient",
    "url": "/assets/brush_tips/krita_tip_052.png",
    "category": "Shapes & Stamps",
    "width": 97,
    "height": 92,
    "isChromatic": false
  },
  {
    "id": "krita_tip_053",
    "name": "Blurred Rake Spine",
    "url": "/assets/brush_tips/krita_tip_053.png",
    "category": "Bristles & Hatching",
    "width": 96,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_054",
    "name": "Spaced Bead Line",
    "url": "/assets/brush_tips/krita_tip_054.png",
    "category": "Shapes & Stamps",
    "width": 96,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_055",
    "name": "Fine Hair Strands",
    "url": "/assets/brush_tips/krita_tip_055.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_056",
    "name": "Crushed Rock Flakes",
    "url": "/assets/brush_tips/krita_tip_056.png",
    "category": "Texture & Grunge",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_057",
    "name": "Oil Impasto Rake",
    "url": "/assets/brush_tips/krita_tip_057.png",
    "category": "Bristles & Hatching",
    "width": 90,
    "height": 92,
    "isChromatic": true
  },
  {
    "id": "krita_tip_058",
    "name": "Rocky Mountain Ledge",
    "url": "/assets/brush_tips/krita_tip_058.png",
    "category": "Foliage & Nature",
    "width": 96,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_059",
    "name": "Dry Pencil Shading",
    "url": "/assets/brush_tips/krita_tip_059.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_060",
    "name": "Speckled Charcoal Rub",
    "url": "/assets/brush_tips/krita_tip_060.png",
    "category": "Texture & Grunge",
    "width": 97,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_061",
    "name": "Fingerprint Ridges",
    "url": "/assets/brush_tips/krita_tip_061.png",
    "category": "Texture & Grunge",
    "width": 96,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_062",
    "name": "Ink Spray Cluster",
    "url": "/assets/brush_tips/krita_tip_062.png",
    "category": "Splatter & Spray",
    "width": 96,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_063",
    "name": "Crackle Mesh Web",
    "url": "/assets/brush_tips/krita_tip_063.png",
    "category": "Texture & Grunge",
    "width": 97,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_064",
    "name": "Diagonal Crosshatch Strip",
    "url": "/assets/brush_tips/krita_tip_064.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_065",
    "name": "Scribbled Line Cloud",
    "url": "/assets/brush_tips/krita_tip_065.png",
    "category": "Bristles & Hatching",
    "width": 96,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_066",
    "name": "Curved Ribbon Segment",
    "url": "/assets/brush_tips/krita_tip_066.png",
    "category": "Shapes & Stamps",
    "width": 96,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_067",
    "name": "Organic Ink Blot",
    "url": "/assets/brush_tips/krita_tip_067.png",
    "category": "Splatter & Spray",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_068",
    "name": "Calligraphic Crescent Nib",
    "url": "/assets/brush_tips/krita_tip_068.png",
    "category": "Shapes & Stamps",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_069",
    "name": "Heavy Gouache Blot",
    "url": "/assets/brush_tips/krita_tip_069.png",
    "category": "Watercolor & Wash",
    "width": 96,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_070",
    "name": "Diffuse Smoke Cloud",
    "url": "/assets/brush_tips/krita_tip_070.png",
    "category": "Watercolor & Wash",
    "width": 96,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_071",
    "name": "Fluffy Cloud Dab",
    "url": "/assets/brush_tips/krita_tip_071.png",
    "category": "Watercolor & Wash",
    "width": 97,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_072",
    "name": "Splatter Burst",
    "url": "/assets/brush_tips/krita_tip_072.png",
    "category": "Splatter & Spray",
    "width": 97,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_073",
    "name": "Dripping Ink Tendril",
    "url": "/assets/brush_tips/krita_tip_073.png",
    "category": "Splatter & Spray",
    "width": 97,
    "height": 91,
    "isChromatic": false
  },
  {
    "id": "krita_tip_074",
    "name": "Rough Vertical Nib",
    "url": "/assets/brush_tips/krita_tip_074.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 91,
    "isChromatic": false
  },
  {
    "id": "krita_tip_075",
    "name": "Lightning Crackle",
    "url": "/assets/brush_tips/krita_tip_075.png",
    "category": "Texture & Grunge",
    "width": 97,
    "height": 91,
    "isChromatic": false
  },
  {
    "id": "krita_tip_076",
    "name": "Scattered Stipple Speckles",
    "url": "/assets/brush_tips/krita_tip_076.png",
    "category": "Splatter & Spray",
    "width": 98,
    "height": 91,
    "isChromatic": false
  },
  {
    "id": "krita_tip_077",
    "name": "Dense Charcoal Slab",
    "url": "/assets/brush_tips/krita_tip_077.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_078",
    "name": "Watercolor Sponge Bloom A",
    "url": "/assets/brush_tips/krita_tip_078.png",
    "category": "Watercolor & Wash",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_079",
    "name": "Watercolor Sponge Bloom B",
    "url": "/assets/brush_tips/krita_tip_079.png",
    "category": "Watercolor & Wash",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_080",
    "name": "Fine Stardust Speckles",
    "url": "/assets/brush_tips/krita_tip_080.png",
    "category": "Splatter & Spray",
    "width": 98,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_081",
    "name": "Flat Blending Chisel",
    "url": "/assets/brush_tips/krita_tip_081.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_082",
    "name": "Wind Slit Texture",
    "url": "/assets/brush_tips/krita_tip_082.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_083",
    "name": "Horizon Bush Line",
    "url": "/assets/brush_tips/krita_tip_083.png",
    "category": "Foliage & Nature",
    "width": 97,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_084",
    "name": "Ragged Ink Line",
    "url": "/assets/brush_tips/krita_tip_084.png",
    "category": "Bristles & Hatching",
    "width": 98,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_085",
    "name": "Segmented Ink Dash",
    "url": "/assets/brush_tips/krita_tip_085.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_086",
    "name": "Dashed Ink Beads",
    "url": "/assets/brush_tips/krita_tip_086.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_087",
    "name": "Dry Ink Column",
    "url": "/assets/brush_tips/krita_tip_087.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_088",
    "name": "Soft Organic Dots",
    "url": "/assets/brush_tips/krita_tip_088.png",
    "category": "Shapes & Stamps",
    "width": 98,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_089",
    "name": "Fine Dashed Needle",
    "url": "/assets/brush_tips/krita_tip_089.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_090",
    "name": "Rough Paint Wash A",
    "url": "/assets/brush_tips/krita_tip_090.png",
    "category": "Watercolor & Wash",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_091",
    "name": "Rough Paint Wash B",
    "url": "/assets/brush_tips/krita_tip_091.png",
    "category": "Watercolor & Wash",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_092",
    "name": "Broad Acrylic Block",
    "url": "/assets/brush_tips/krita_tip_092.png",
    "category": "Bristles & Hatching",
    "width": 98,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_093",
    "name": "Rough Charcoal Scratches",
    "url": "/assets/brush_tips/krita_tip_093.png",
    "category": "Texture & Grunge",
    "width": 97,
    "height": 95,
    "isChromatic": false
  },
  {
    "id": "krita_tip_094",
    "name": "Noise Texture Cloud",
    "url": "/assets/brush_tips/krita_tip_094.png",
    "category": "Watercolor & Wash",
    "width": 97,
    "height": 95,
    "isChromatic": false
  },
  {
    "id": "krita_tip_095",
    "name": "Ink Dripping Spires",
    "url": "/assets/brush_tips/krita_tip_095.png",
    "category": "Splatter & Spray",
    "width": 97,
    "height": 95,
    "isChromatic": false
  },
  {
    "id": "krita_tip_096",
    "name": "Rough Chalk Shading",
    "url": "/assets/brush_tips/krita_tip_096.png",
    "category": "Bristles & Hatching",
    "width": 98,
    "height": 95,
    "isChromatic": false
  },
  {
    "id": "krita_tip_097",
    "name": "Speckled Texture Field",
    "url": "/assets/brush_tips/krita_tip_097.png",
    "category": "Texture & Grunge",
    "width": 98,
    "height": 93,
    "isChromatic": false
  },
  {
    "id": "krita_tip_098",
    "name": "Watercolor Flow Wash",
    "url": "/assets/brush_tips/krita_tip_098.png",
    "category": "Watercolor & Wash",
    "width": 97,
    "height": 93,
    "isChromatic": false
  },
  {
    "id": "krita_tip_099",
    "name": "Windblown Debris Flakes",
    "url": "/assets/brush_tips/krita_tip_099.png",
    "category": "Splatter & Spray",
    "width": 97,
    "height": 93,
    "isChromatic": false
  },
  {
    "id": "krita_tip_100",
    "name": "Soft Smoke Stream",
    "url": "/assets/brush_tips/krita_tip_100.png",
    "category": "Watercolor & Wash",
    "width": 96,
    "height": 93,
    "isChromatic": false
  },
  {
    "id": "krita_tip_101",
    "name": "Crosshatch Scrape Marks",
    "url": "/assets/brush_tips/krita_tip_101.png",
    "category": "Texture & Grunge",
    "width": 98,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_102",
    "name": "Fine Hair Strand",
    "url": "/assets/brush_tips/krita_tip_102.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_103",
    "name": "Ink Spike Blade",
    "url": "/assets/brush_tips/krita_tip_103.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_104",
    "name": "Hair Needle Tip",
    "url": "/assets/brush_tips/krita_tip_104.png",
    "category": "Bristles & Hatching",
    "width": 96,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_105",
    "name": "Golden Ratio Spiral",
    "url": "/assets/brush_tips/krita_tip_105.png",
    "category": "Shapes & Stamps",
    "width": 98,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_106",
    "name": "Rule of Thirds Grid",
    "url": "/assets/brush_tips/krita_tip_106.png",
    "category": "Shapes & Stamps",
    "width": 97,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_107",
    "name": "Pixel Halftone Cross",
    "url": "/assets/brush_tips/krita_tip_107.png",
    "category": "Shapes & Stamps",
    "width": 97,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_108",
    "name": "Palette Knife Notch",
    "url": "/assets/brush_tips/krita_tip_108.png",
    "category": "Bristles & Hatching",
    "width": 96,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_109",
    "name": "Diagonal Pixel Step",
    "url": "/assets/brush_tips/krita_tip_109.png",
    "category": "Shapes & Stamps",
    "width": 98,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_110",
    "name": "Spectral Rainbow Bar",
    "url": "/assets/brush_tips/krita_tip_110.png",
    "category": "Shapes & Stamps",
    "width": 97,
    "height": 98,
    "isChromatic": true
  },
  {
    "id": "krita_tip_111",
    "name": "Soft Hair Clump",
    "url": "/assets/brush_tips/krita_tip_111.png",
    "category": "Bristles & Hatching",
    "width": 97,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_112",
    "name": "Horizontal Speed Lines",
    "url": "/assets/brush_tips/krita_tip_112.png",
    "category": "Bristles & Hatching",
    "width": 96,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_113",
    "name": "Granite Rock Shelf",
    "url": "/assets/brush_tips/krita_tip_113.png",
    "category": "Foliage & Nature",
    "width": 98,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_114",
    "name": "Soft Oval Cloud Wash",
    "url": "/assets/brush_tips/krita_tip_114.png",
    "category": "Watercolor & Wash",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_115",
    "name": "Scattered Confetti Specks",
    "url": "/assets/brush_tips/krita_tip_115.png",
    "category": "Splatter & Spray",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_116",
    "name": "Rounded Rectangle Stamp",
    "url": "/assets/brush_tips/krita_tip_116.png",
    "category": "Shapes & Stamps",
    "width": 96,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_117",
    "name": "Soft Rectangle Falloff",
    "url": "/assets/brush_tips/krita_tip_117.png",
    "category": "Shapes & Stamps",
    "width": 98,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_118",
    "name": "Horizontal Gradient Pill",
    "url": "/assets/brush_tips/krita_tip_118.png",
    "category": "Shapes & Stamps",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_119",
    "name": "Thin Sharp Ellipse",
    "url": "/assets/brush_tips/krita_tip_119.png",
    "category": "Shapes & Stamps",
    "width": 97,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_120",
    "name": "Soft Oval Airbrush",
    "url": "/assets/brush_tips/krita_tip_120.png",
    "category": "Shapes & Stamps",
    "width": 96,
    "height": 97,
    "isChromatic": false
  },
  {
    "id": "krita_tip_121",
    "name": "Soft Clover Cloud",
    "url": "/assets/brush_tips/krita_tip_121.png",
    "category": "Watercolor & Wash",
    "width": 100,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_122",
    "name": "Petal / Butterfly Wing",
    "url": "/assets/brush_tips/krita_tip_122.png",
    "category": "Foliage & Nature",
    "width": 96,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_123",
    "name": "Solid Equilateral Triangle",
    "url": "/assets/brush_tips/krita_tip_123.png",
    "category": "Shapes & Stamps",
    "width": 97,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_124",
    "name": "Sharp Triangle Nib",
    "url": "/assets/brush_tips/krita_tip_124.png",
    "category": "Shapes & Stamps",
    "width": 106,
    "height": 96,
    "isChromatic": false
  },
  {
    "id": "krita_tip_125",
    "name": "Circular Ring Stencil",
    "url": "/assets/brush_tips/krita_tip_125.png",
    "category": "Shapes & Stamps",
    "width": 100,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_126",
    "name": "Horizontal Shading Rake",
    "url": "/assets/brush_tips/krita_tip_126.png",
    "category": "Bristles & Hatching",
    "width": 96,
    "height": 98,
    "isChromatic": false
  },
  {
    "id": "krita_tip_127",
    "name": "Watercolor Edge Bloom",
    "url": "/assets/brush_tips/krita_tip_127.png",
    "category": "Watercolor & Wash",
    "width": 97,
    "height": 98,
    "isChromatic": false
  }
];
