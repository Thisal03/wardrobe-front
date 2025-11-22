# Matching Set Generator

A Next.js frontend application for generating matching clothing sets using AI. Upload a base image (person/model) and reference images (clothing items) to create AI-generated matching sets.

## Features

- 🖼️ **Image Upload**: Drag & drop or click to upload images
- 📸 **Multiple Reference Images**: Upload multiple clothing items as reference
- ✏️ **Custom Prompts**: Optional custom text prompts for generation
- 🔄 **Real-time Status**: Automatic status polling with visual indicators
- 🎨 **Result Gallery**: View and download generated images
- 🌙 **Dark Mode**: Automatic dark mode support

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the `wardrobe-app` directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to find these values:**
- Go to your Supabase project dashboard
- Navigate to Settings → API
- Copy the "Project URL" for `NEXT_PUBLIC_SUPABASE_URL`
- Copy the "anon public" key for `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Upload Base Image**: Select or drag & drop a photo of a person/model
2. **Upload Reference Images**: Select one or more clothing item images
3. **Optional Prompt**: Add a custom prompt or use the default
4. **Generate**: Click "Generate Matching Set" to start the process
5. **Wait for Results**: The app will automatically poll for status updates
6. **View & Download**: Once complete, view and download the generated images

## File Requirements

- **File Types**: Images only (JPEG, PNG, etc.)
- **Max Size**: 10MB per image
- **Base Image**: 1 required
- **Reference Images**: At least 1 required, multiple allowed

## API Endpoints

The app communicates with Supabase Edge Functions:

- `POST /functions/v1/generate-matching-set/remix-images` - Submit generation job
- `POST /functions/v1/generate-matching-set/status` - Check job status

## Project Structure

```
wardrobe-app/
├── app/
│   ├── page.tsx              # Main matching set generator page
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── components/
│   ├── ImageUpload.tsx       # Image upload component with drag & drop
│   ├── StatusDisplay.tsx     # Status indicator component
│   └── ResultGallery.tsx      # Generated images gallery
├── lib/
│   ├── supabase.ts           # Supabase client configuration
│   └── api/
│       └── matchingSet.ts    # API functions for matching set generation
└── package.json
```

## Technologies

- **Next.js 16** - React framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **Supabase** - Backend services

## Troubleshooting

### Images not uploading?
- Check file size (must be < 10MB)
- Verify file is an image type
- Check browser console for errors

### Status not updating?
- Verify environment variables are set correctly
- Check that Supabase Edge Function is deployed
- Check browser console for API errors

### Generation fails?
- Ensure at least one base image and one reference image
- Check that images are accessible
- Verify Supabase function URL is correct

## License

MIT
