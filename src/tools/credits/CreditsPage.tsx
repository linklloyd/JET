export function CreditsPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Credits</h2>
        <p className="text-sm text-zinc-500 mt-2">Tools, libraries, and people that made JET possible</p>
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-zinc-800">Inspirations & References</h3>
        <CreditCard
          name="waifu2x"
          author="nagadomi"
          url="https://github.com/nagadomi/waifu2x"
          description="Image Upscaler is inspired by waifu2x — a deep learning-based image super-resolution tool for anime-style art and photos. The upscaling approach (Lanczos, noise reduction, sharpening) is modeled after waifu2x's workflow. MIT License."
        />
        <CreditCard
          name="pixel-tools"
          author="Sergey Khoroshavin"
          url="https://github.com/skhoroshavin/pixel-tools"
          description="Atlas Pack, Font Pack, Tile Pack, and Recolor tools are inspired by pixel-tools — a set of Go-based CLI tools for pixel art asset pipelines. MIT License."
        />
        <CreditCard
          name="Cobalt"
          author="imputnet"
          url="https://github.com/imputnet/cobalt"
          description="Social Converter references the Cobalt API for URL-based media downloads. Currently disabled due to Turnstile domain restrictions on public instances. AGPL-3.0 License."
        />
        <CreditCard
          name="Mixamo"
          author="Adobe"
          url="https://www.mixamo.com"
          description="3D Spritesheet Generator is designed to work with Mixamo's free 3D character models and animations (FBX format)."
        />
        <CreditCard
          name="Earthbound Battle Backgrounds JS"
          author="gjtorikian, @kdex, Mr. Accident"
          url="https://github.com/gjtorikian/Earthbound-Battle-Backgrounds-JS"
          description="EB Backgrounds generator ports the sinusoidal distortion engine from this project — recreating all 327 Earthbound battle background styles in the browser. MIT License."
        />
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-zinc-800">Libraries</h3>
        <div className="grid grid-cols-2 gap-3">
          <LibCard name="React 19" url="https://react.dev" description="UI framework" />
          <LibCard name="Vite 6" url="https://vite.dev" description="Build tool & dev server" />
          <LibCard name="TypeScript" url="https://www.typescriptlang.org" description="Type-safe JavaScript" />
          <LibCard name="Tailwind CSS v4" url="https://tailwindcss.com" description="Utility-first CSS" />
          <LibCard name="Three.js" url="https://threejs.org" description="3D rendering & model loading (FBX/GLTF)" />
          <LibCard name="FFmpeg.wasm" url="https://ffmpegwasm.netlify.app" description="Client-side video/audio conversion" />
          <LibCard name="JSZip" url="https://stuk.github.io/jszip" description="ZIP file generation in browser" />
          <LibCard name="Lucide" url="https://lucide.dev" description="Icon set" />
          <LibCard name="React Router" url="https://reactrouter.com" description="Client-side routing" />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-zinc-800">Algorithms</h3>
        <div className="space-y-2 text-sm text-zinc-600">
          <p><span className="font-medium text-zinc-700">Lanczos Resampling</span> — High-quality image upscaling with sinc-based kernel (Image Upscaler)</p>
          <p><span className="font-medium text-zinc-700">Bicubic Interpolation</span> — Smooth image upscaling (Image Upscaler)</p>
          <p><span className="font-medium text-zinc-700">EPX / Scale2x</span> — Pixel art upscaling by Andrea Mazzoleni (Pixel Upscaler)</p>
          <p><span className="font-medium text-zinc-700">xBR</span> — Hyllian's pixel scaling filter (Pixel Upscaler)</p>
          <p><span className="font-medium text-zinc-700">Floyd-Steinberg Dithering</span> — Error diffusion for color reduction (Image to Pixel Art)</p>
          <p><span className="font-medium text-zinc-700">Median Cut</span> — Color quantization for palette extraction (Color Extractor)</p>
          <p><span className="font-medium text-zinc-700">Perlin Noise</span> — Procedural terrain/overworld generation (Map Generator)</p>
          <p><span className="font-medium text-zinc-700">BSP Dungeon Generation</span> — Binary space partitioning for room placement (Map Generator)</p>
          <p><span className="font-medium text-zinc-700">LZW Compression</span> — GIF encoding with variable-length codes (Sprite to GIF)</p>
          <p><span className="font-medium text-zinc-700">ICO/ICNS Encoding</span> — Multi-resolution icon file generation (Format Converter)</p>
          <p><span className="font-medium text-zinc-700">Simplex Noise</span> — Improved gradient noise by Ken Perlin (Noise Generator)</p>
          <p><span className="font-medium text-zinc-700">Voronoi / Worley Noise</span> — Cell-based procedural texture generation (Noise Generator)</p>
          <p><span className="font-medium text-zinc-700">Sinusoidal Distortion</span> — Scanline-based image warping for animated backgrounds (EB Backgrounds)</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-800">About JET</h3>
        <p className="text-sm text-zinc-600">
          <span className="font-bold text-zinc-800">JET</span> (Just Enough Tools) is a client-side web application with handy tools for creators and developers.
          All processing happens in your browser — no files are uploaded to any server. Your data stays private.
        </p>
        <p className="text-sm text-zinc-600">
          Built with TypeScript, React 19, Vite 6, and Tailwind CSS v4.
        </p>
        <div className="pt-3 border-t border-zinc-100 mt-4">
          <p className="text-sm text-zinc-700">
            Created by <span className="font-bold text-zinc-900">Cosmical Cheese</span>
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Built with assistance from Claude (Anthropic)
          </p>
        </div>
      </section>
    </div>
  )
}

function CreditCard({ name, author, url, description }: { name: string; author: string; url: string; description: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-600 hover:underline">{name}</a>
          <span className="text-sm text-zinc-500"> by {author}</span>
        </div>
      </div>
      <p className="text-xs text-zinc-600">{description}</p>
    </div>
  )
}

function LibCard({ name, url, description }: { name: string; url: string; description: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="bg-white border border-zinc-200 rounded-lg p-3 hover:border-blue-300 transition-colors block">
      <p className="text-sm font-medium text-zinc-800">{name}</p>
      <p className="text-xs text-zinc-500">{description}</p>
    </a>
  )
}
