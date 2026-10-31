import type { MapBookmark, ParcelFeature, PlanningOverlay, PlanningZone, SearchResult } from '../types'

export const PLANNING_ZONES: Record<string, PlanningZone> = {
  CCZ1: {
    code: 'CCZ1',
    name: 'Capital City Zone - Schedule 1',
    category: 'commercial',
    fillColor: '#3b82f6',
    strokeColor: '#1d4ed8',
    textColor: '#1e40af',
    ordinanceUrl: 'https://planning-schemes.api.delwp.vic.gov.au/schemes/melbourne/ordinance/37_04s01_melb.pdf',
    schedule: 'Schedule 1 - Outside The Retail Core'
  },
  C1Z: {
    code: 'C1Z',
    name: 'Commercial 1 Zone',
    category: 'commercial',
    fillColor: '#60a5fa',
    strokeColor: '#2563eb',
    textColor: '#1d4ed8',
    ordinanceUrl: 'https://planning-schemes.api.delwp.vic.gov.au/schemes/vpps/34_01.pdf',
    schedule: 'Standard Commercial Provision'
  },
  GRZ1: {
    code: 'GRZ1',
    name: 'General Residential Zone - Schedule 1',
    category: 'residential',
    fillColor: '#fb7185',
    strokeColor: '#e11d48',
    textColor: '#9f1239',
    ordinanceUrl: 'https://planning-schemes.api.delwp.vic.gov.au/schemes/vpps/32_08.pdf',
    schedule: 'Schedule 1 - General Residential Areas'
  },
  RGZ1: {
    code: 'RGZ1',
    name: 'Residential Growth Zone - Schedule 1',
    category: 'residential',
    fillColor: '#f43f5e',
    strokeColor: '#be123c',
    textColor: '#881337',
    ordinanceUrl: 'https://planning-schemes.api.delwp.vic.gov.au/schemes/vpps/32_07.pdf',
    schedule: 'Schedule 1 - Transit & Activity Center Corridor'
  },
  IN1Z: {
    code: 'IN1Z',
    name: 'Industrial 1 Zone',
    category: 'industrial',
    fillColor: '#a78bfa',
    strokeColor: '#7c3aed',
    textColor: '#5b21b6',
    ordinanceUrl: 'https://planning-schemes.api.delwp.vic.gov.au/schemes/vpps/33_01.pdf',
    schedule: 'General Industrial'
  },
  PPRZ: {
    code: 'PPRZ',
    name: 'Public Park and Recreation Zone',
    category: 'public',
    fillColor: '#4ade80',
    strokeColor: '#16a34a',
    textColor: '#166534',
    ordinanceUrl: 'https://planning-schemes.api.delwp.vic.gov.au/schemes/vpps/36_02.pdf',
    schedule: 'Crown Land & Municipal Parks'
  },
  MUZ: {
    code: 'MUZ',
    name: 'Mixed Use Zone',
    category: 'commercial',
    fillColor: '#c084fc',
    strokeColor: '#9333ea',
    textColor: '#6b21a8',
    ordinanceUrl: 'https://planning-schemes.api.delwp.vic.gov.au/schemes/vpps/32_04.pdf',
    schedule: 'Inner City Mixed Urban'
  }
}

export const PLANNING_OVERLAYS: Record<string, PlanningOverlay> = {
  HO500: {
    code: 'HO500',
    name: 'Heritage Overlay (HO500)',
    category: 'heritage',
    fillColor: 'rgba(217, 119, 6, 0.25)',
    strokeColor: '#b45309',
    ordinanceUrl: 'https://planning-schemes.api.delwp.vic.gov.au/schemes/melbourne/ordinance/43_01s_melb.pdf',
    schedule: 'Melbourne Central Heritage Precinct'
  },
  DDO1: {
    code: 'DDO1',
    name: 'Design and Development Overlay - Schedule 1',
    category: 'design',
    fillColor: 'rgba(14, 165, 233, 0.22)',
    strokeColor: '#0284c7',
    ordinanceUrl: 'https://planning-schemes.api.delwp.vic.gov.au/schemes/melbourne/ordinance/43_02s01_melb.pdf',
    schedule: 'Active Street Frontages & Podium Height Controls'
  },
  SBO: {
    code: 'SBO',
    name: 'Special Building Overlay',
    category: 'flooding',
    fillColor: 'rgba(56, 189, 248, 0.28)',
    strokeColor: '#0284c7',
    ordinanceUrl: 'https://planning-schemes.api.delwp.vic.gov.au/schemes/vpps/44_05.pdf',
    schedule: 'Melbourne Water Overland Flow Path'
  },
  BMO: {
    code: 'BMO',
    name: 'Bushfire Management Overlay',
    category: 'bushfire',
    fillColor: 'rgba(239, 68, 68, 0.25)',
    strokeColor: '#dc2626',
    ordinanceUrl: 'https://planning-schemes.api.delwp.vic.gov.au/schemes/vpps/44_06.pdf',
    schedule: 'Bushfire Risk Area Planning Provision'
  }
}

export const SAMPLE_PARCELS: ParcelFeature[] = [
  {
    id: 'parcel-1',
    address: '120 Swanston Street, Melbourne VIC 3000',
    lotPlan: 'Lot 1 TP842910',
    spi: '1\\TP842910',
    councilPropId: '519284',
    lga: 'City of Melbourne',
    lgaCode: '311',
    ward: 'Hoddle Ward',
    areaM2: 842,
    perimeterM: 118,
    zone: PLANNING_ZONES.CCZ1,
    overlays: [PLANNING_OVERLAYS.HO500, PLANNING_OVERLAYS.DDO1],
    center: [144.9658, -37.8143],
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [144.9655, -37.8141],
          [144.9661, -37.8141],
          [144.9661, -37.8145],
          [144.9655, -37.8145],
          [144.9655, -37.8141]
        ]
      ]
    }
  },
  {
    id: 'parcel-2',
    address: '450 Flinders Street, Melbourne VIC 3000',
    lotPlan: 'Lot 12 PS423188',
    spi: '12\\PS423188',
    councilPropId: '630129',
    lga: 'City of Melbourne',
    lgaCode: '311',
    ward: 'Docklands Ward',
    areaM2: 1450,
    perimeterM: 154,
    zone: PLANNING_ZONES.CCZ1,
    overlays: [PLANNING_OVERLAYS.DDO1, PLANNING_OVERLAYS.SBO],
    center: [144.9582, -37.8194],
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [144.9578, -37.8191],
          [144.9586, -37.8191],
          [144.9586, -37.8197],
          [144.9578, -37.8197],
          [144.9578, -37.8191]
        ]
      ]
    }
  },
  {
    id: 'parcel-3',
    address: '88 Gertrude Street, Fitzroy VIC 3065',
    lotPlan: 'Lot 2 RP30192',
    spi: '2\\RP30192',
    councilPropId: '204911',
    lga: 'City of Yarra',
    lgaCode: '370',
    ward: 'Langridge Ward',
    areaM2: 410,
    perimeterM: 84,
    zone: PLANNING_ZONES.C1Z,
    overlays: [PLANNING_OVERLAYS.HO500],
    center: [144.9765, -37.8052],
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [144.9762, -37.805],
          [144.9768, -37.805],
          [144.9768, -37.8054],
          [144.9762, -37.8054],
          [144.9762, -37.805]
        ]
      ]
    }
  },
  {
    id: 'parcel-4',
    address: '15 Drummond Street, Carlton VIC 3053',
    lotPlan: 'Lot 4 PS99120',
    spi: '4\\PS99120',
    councilPropId: '109283',
    lga: 'City of Melbourne',
    lgaCode: '311',
    ward: 'Carlton Ward',
    areaM2: 520,
    perimeterM: 92,
    zone: PLANNING_ZONES.GRZ1,
    overlays: [PLANNING_OVERLAYS.HO500],
    center: [144.9682, -37.8062],
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [144.9679, -37.806],
          [144.9685, -37.806],
          [144.9685, -37.8064],
          [144.9679, -37.8064],
          [144.9679, -37.806]
        ]
      ]
    }
  },
  {
    id: 'parcel-5',
    address: 'Carlton Gardens (Royal Exhibition Building), Carlton VIC 3053',
    lotPlan: 'Crown Allotment 20 Sec 42',
    spi: '20~42\\PP3111',
    councilPropId: '001004',
    lga: 'City of Melbourne',
    lgaCode: '311',
    ward: 'Carlton Ward',
    areaM2: 260000,
    perimeterM: 2100,
    zone: PLANNING_ZONES.PPRZ,
    overlays: [PLANNING_OVERLAYS.HO500],
    center: [144.9715, -37.8058],
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [144.9695, -37.8025],
          [144.9735, -37.8025],
          [144.9735, -37.8091],
          [144.9695, -37.8091],
          [144.9695, -37.8025]
        ]
      ]
    }
  },
  {
    id: 'parcel-6',
    address: '320 Spencer Street, West Melbourne VIC 3003',
    lotPlan: 'Lot 5 PS512933',
    spi: '5\\PS512933',
    councilPropId: '492812',
    lga: 'City of Melbourne',
    lgaCode: '311',
    ward: 'Batman Ward',
    areaM2: 1120,
    perimeterM: 136,
    zone: PLANNING_ZONES.RGZ1,
    overlays: [PLANNING_OVERLAYS.DDO1],
    center: [144.9515, -37.8132],
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [144.9511, -37.8129],
          [144.9519, -37.8129],
          [144.9519, -37.8135],
          [144.9511, -37.8135],
          [144.9511, -37.8129]
        ]
      ]
    }
  },
  {
    id: 'parcel-7',
    address: '25 Riverside Quay, Southbank VIC 3006',
    lotPlan: 'Lot 3 PS419201',
    spi: '3\\PS419201',
    councilPropId: '774102',
    lga: 'City of Melbourne',
    lgaCode: '311',
    ward: 'Southbank Ward',
    areaM2: 2400,
    perimeterM: 202,
    zone: PLANNING_ZONES.CCZ1,
    overlays: [PLANNING_OVERLAYS.DDO1, PLANNING_OVERLAYS.SBO],
    center: [144.9612, -37.8214],
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [144.9606, -37.8209],
          [144.9618, -37.8209],
          [144.9618, -37.8219],
          [144.9606, -37.8219],
          [144.9606, -37.8209]
        ]
      ]
    }
  },
  {
    id: 'parcel-8',
    address: '150 Clarendon Street, East Melbourne VIC 3002',
    lotPlan: 'Lot 8 RP12903',
    spi: '8\\RP12903',
    councilPropId: '339108',
    lga: 'City of Melbourne',
    lgaCode: '311',
    ward: 'East Melbourne Ward',
    areaM2: 1850,
    perimeterM: 178,
    zone: PLANNING_ZONES.MUZ,
    overlays: [PLANNING_OVERLAYS.HO500],
    center: [144.9812, -37.8138],
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [144.9806, -37.8133],
          [144.9818, -37.8133],
          [144.9818, -37.8143],
          [144.9806, -37.8143],
          [144.9806, -37.8133]
        ]
      ]
    }
  }
]

export const ZONE_POLYGONS_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: {
        code: 'CCZ1',
        name: 'Capital City Zone',
        color: PLANNING_ZONES.CCZ1.fillColor,
        stroke: PLANNING_ZONES.CCZ1.strokeColor
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [144.950, -37.822],
            [144.973, -37.822],
            [144.973, -37.808],
            [144.950, -37.808],
            [144.950, -37.822]
          ]
        ]
      }
    },
    {
      type: 'Feature' as const,
      properties: {
        code: 'GRZ1',
        name: 'General Residential Zone',
        color: PLANNING_ZONES.GRZ1.fillColor,
        stroke: PLANNING_ZONES.GRZ1.strokeColor
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [144.960, -37.808],
            [144.975, -37.808],
            [144.975, -37.798],
            [144.960, -37.798],
            [144.960, -37.808]
          ]
        ]
      }
    },
    {
      type: 'Feature' as const,
      properties: {
        code: 'C1Z',
        name: 'Commercial 1 Zone',
        color: PLANNING_ZONES.C1Z.fillColor,
        stroke: PLANNING_ZONES.C1Z.strokeColor
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [144.975, -37.812],
            [144.985, -37.812],
            [144.985, -37.802],
            [144.975, -37.802],
            [144.975, -37.812]
          ]
        ]
      }
    },
    {
      type: 'Feature' as const,
      properties: {
        code: 'PPRZ',
        name: 'Public Park and Recreation Zone',
        color: PLANNING_ZONES.PPRZ.fillColor,
        stroke: PLANNING_ZONES.PPRZ.strokeColor
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [144.969, -37.809],
            [144.974, -37.809],
            [144.974, -37.802],
            [144.969, -37.802],
            [144.969, -37.809]
          ]
        ]
      }
    },
    {
      type: 'Feature' as const,
      properties: {
        code: 'MUZ',
        name: 'Mixed Use Zone',
        color: PLANNING_ZONES.MUZ.fillColor,
        stroke: PLANNING_ZONES.MUZ.strokeColor
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [144.978, -37.818],
            [144.988, -37.818],
            [144.988, -37.810],
            [144.978, -37.810],
            [144.978, -37.818]
          ]
        ]
      }
    }
  ]
}

export const OVERLAYS_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: {
        code: 'HO500',
        name: 'Heritage Overlay HO500',
        color: '#d97706',
        stroke: '#b45309'
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [144.960, -37.818],
            [144.972, -37.818],
            [144.972, -37.811],
            [144.960, -37.811],
            [144.960, -37.818]
          ]
        ]
      }
    },
    {
      type: 'Feature' as const,
      properties: {
        code: 'DDO1',
        name: 'Design & Development Overlay DDO1',
        color: '#0284c7',
        stroke: '#0369a1'
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [144.952, -37.822],
            [144.968, -37.822],
            [144.968, -37.815],
            [144.952, -37.815],
            [144.952, -37.822]
          ]
        ]
      }
    },
    {
      type: 'Feature' as const,
      properties: {
        code: 'SBO',
        name: 'Special Building Overlay (Flooding)',
        color: '#06b6d4',
        stroke: '#0891b2'
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [144.955, -37.824],
            [144.967, -37.824],
            [144.967, -37.820],
            [144.955, -37.820],
            [144.955, -37.824]
          ]
        ]
      }
    }
  ]
}

export const LGA_BOUNDARIES_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: { name: 'City of Melbourne', code: '311' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [144.900, -37.850],
            [144.990, -37.850],
            [144.990, -37.780],
            [144.900, -37.780],
            [144.900, -37.850]
          ]
        ]
      }
    },
    {
      type: 'Feature' as const,
      properties: { name: 'City of Yarra', code: '370' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [144.975, -37.830],
            [145.030, -37.830],
            [145.030, -37.770],
            [144.975, -37.770],
            [144.975, -37.830]
          ]
        ]
      }
    }
  ]
}

export const BUILDINGS_3D_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: { height: 180, base_height: 0, name: 'Bourke Place' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [144.956, -37.816],
            [144.957, -37.816],
            [144.957, -37.817],
            [144.956, -37.817],
            [144.956, -37.816]
          ]
        ]
      }
    },
    {
      type: 'Feature' as const,
      properties: { height: 220, base_height: 0, name: 'Collins Centre' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [144.963, -37.815],
            [144.964, -37.815],
            [144.964, -37.816],
            [144.963, -37.816],
            [144.963, -37.815]
          ]
        ]
      }
    },
    {
      type: 'Feature' as const,
      properties: { height: 140, base_height: 0, name: 'Swanston Tower' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [144.965, -37.813],
            [144.966, -37.813],
            [144.966, -37.814],
            [144.965, -37.814],
            [144.965, -37.813]
          ]
        ]
      }
    },
    {
      type: 'Feature' as const,
      properties: { height: 260, base_height: 0, name: 'Southbank Tower' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [144.961, -37.821],
            [144.962, -37.821],
            [144.962, -37.822],
            [144.961, -37.822],
            [144.961, -37.821]
          ]
        ]
      }
    }
  ]
}

export const DEFAULT_BOOKMARKS: MapBookmark[] = [
  {
    id: 'bm-cbd',
    name: 'Melbourne CBD & Retail Core',
    description: 'Capital City Zone (CCZ1) & Hoddle Grid',
    center: [144.9631, -37.8136],
    zoom: 15.5,
    pitch: 0,
    bearing: 0
  },
  {
    id: 'bm-carlton',
    name: 'Carlton Gardens & Exhibition',
    description: 'World Heritage Precinct (HO500) & Parks (PPRZ)',
    center: [144.9715, -37.8058],
    zoom: 16,
    pitch: 25,
    bearing: -10
  },
  {
    id: 'bm-fitzroy',
    name: 'Fitzroy Commercial Strip (Gertrude St)',
    description: 'Commercial 1 Zone (C1Z) & Heritage Corridor',
    center: [144.9765, -37.8052],
    zoom: 16.5,
    pitch: 0,
    bearing: 0
  },
  {
    id: 'bm-southbank',
    name: 'Southbank Riverside & Arts Precinct',
    description: 'High-density mixed urban zone and river corridor',
    center: [144.9612, -37.8214],
    zoom: 15.8,
    pitch: 35,
    bearing: 20
  },
  {
    id: 'bm-victoria',
    name: 'Victoria Statewide Extent',
    description: 'Complete State of Victoria spatial boundary',
    center: [145.4, -36.5],
    zoom: 6.8,
    pitch: 0,
    bearing: 0
  }
]

export const SEARCH_INDEX: SearchResult[] = [
  ...SAMPLE_PARCELS.map((p) => ({
    id: p.id,
    title: p.address,
    subtitle: `${p.lotPlan} | SPI: ${p.spi} | ${p.lga}`,
    category: 'address' as const,
    center: p.center,
    zoom: 17.5,
    parcelId: p.id
  })),
  ...SAMPLE_PARCELS.map((p) => ({
    id: `spi-${p.id}`,
    title: p.spi,
    subtitle: `${p.address} (${p.lotPlan})`,
    category: 'spi' as const,
    center: p.center,
    zoom: 17.5,
    parcelId: p.id
  })),
  {
    id: 'lga-melbourne',
    title: 'City of Melbourne',
    subtitle: 'Local Government Area (LGA #311)',
    category: 'lga',
    center: [144.9631, -37.8136],
    zoom: 13
  },
  {
    id: 'lga-yarra',
    title: 'City of Yarra',
    subtitle: 'Local Government Area (LGA #370)',
    category: 'lga',
    center: [144.9912, -37.8105],
    zoom: 13
  },
  {
    id: 'zone-ccz1',
    title: 'Capital City Zone (CCZ1)',
    subtitle: 'Melbourne Planning Scheme Clause 37.04',
    category: 'zone',
    center: [144.9631, -37.8136],
    zoom: 14.5
  },
  {
    id: 'zone-grz1',
    title: 'General Residential Zone (GRZ1)',
    subtitle: 'Residential planning provision Schedule 1',
    category: 'zone',
    center: [144.9682, -37.8062],
    zoom: 15
  }
]
