import { Wizard } from "@/components/Wizard";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function CreatorSetupPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Soft background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary opacity-5 blur-[120px] rounded-full pointer-events-none" />

      <main className="container mx-auto px-4 py-12 sm:py-20 relative z-10 flex flex-col gap-8">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Event Configuration</h1>
          <p className="text-slate-400 max-w-2xl">Use this wizard to define the parameters of your music event. We will automatically map these constraints into a pgvector-based similarity search to generate the perfect baseline playlist.</p>
        </div>

        <Wizard />
      </main>
    </div>
  );
}
