import { readFileSync, writeFileSync } from 'node:fs';

const sourcePath = new URL('../src/ui/vehicle-results.html', import.meta.url);
const source = readFileSync(sourcePath, 'utf8');
const marker = '  <script type="module">';

const injected = String.raw`
  <script>
    const svg = (label, color) => 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300">' +
      '<rect width="100%" height="100%" fill="' + color + '"/>' +
      '<text x="50%" y="48%" fill="white" font-family="Arial" font-size="30" text-anchor="middle">' + label + '</text>' +
      '<text x="50%" y="62%" fill="white" font-family="Arial" font-size="18" text-anchor="middle">Charlotte inventory</text></svg>'
    );
    const vehicle = index => ({
      id: '1FTFW1RG' + String(index).padStart(9, '0'),
      title: (2025 - index % 7) + ' Ford F-150 ' + ['Lariat', 'XLT', 'Raptor', 'Platinum'][index % 4],
      condition: 'used',
      baseIdentity: {
        vin: '1FTFW1RG' + String(index).padStart(9, '0'),
        year: 2025 - index % 7,
        make: 'Ford',
        model: 'F-150',
        trim: ['Lariat', 'XLT', 'Raptor', 'Platinum'][index % 4],
      },
      pricing: { price: 32000 + index * 225, currency: 'USD' },
      coreSpecs: { miles: 12000 + index * 517, bodyType: 'Pickup' },
      media: { primaryPhotoUrl: svg('Ford F-150 ' + (index + 1), ['#164e63', '#1d4ed8', '#166534'][index % 3]), photoUrls: [] },
      location: { dealer: { dealerId: 'dealer-' + index, name: 'Charlotte Ford ' + (index % 5 + 1), city: 'Charlotte', state: 'NC', latitude: 35.10 + (index % 10) * .025, longitude: -80.97 + (index % 8) * .035 } },
    });
    const searchParams = { location: 'Charlotte, NC', condition: 'used', make: 'Ford', model: 'F-150', maxPrice: 48000, radiusMiles: 50 };
    const initial = Array.from({ length: 50 }, (_, index) => vehicle(index));
    const remaining = Array.from({ length: 9 }, (_, index) => vehicle(index + 50));
    const envelope = vehicles => ({ structuredContent: { results: { vehicles, totalCount: 59, searchParams, dealerSummary: [] } } });
    window.openai = {
      toolInput: searchParams,
      toolOutput: envelope(initial),
      toolResponseMetadata: {},
      widgetState: null,
      displayMode: 'inline',
      setWidgetState(value) { this.widgetState = value; },
      notifyIntrinsicHeight() {},
      emitToolEvent() {},
      requestDisplayMode: async () => {},
      callTool: async (_name, args) => envelope(args.pageOffset ? remaining : initial),
      on() {},
    };
    if (location.hash === '#expanded') {
      setTimeout(() => document.querySelector('.inventory-progress-button')?.click(), 1200);
      setTimeout(() => {
        const rail = document.getElementById('rail');
        if (rail) rail.scrollLeft = rail.scrollWidth;
      }, 2600);
    }
  </script>
`;

if (!source.includes(marker)) throw new Error('Widget script marker not found');
writeFileSync('/tmp/drevvy-widget-harness.html', source.replace(marker, injected + marker));
console.log('/tmp/drevvy-widget-harness.html');
