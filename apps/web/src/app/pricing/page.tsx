import { Navbar } from "@/components/Navbar";
import { PricingSection } from "@/components/PricingSection";

// Stripe returns people here when they cancel checkout, so it shows the same
// plans as the landing page rather than its own copy.
export default function PricingPage() {
  return (
    <main className="min-h-screen" style={{ background: "#ffffff" }}>
      <Navbar />
      <div className="pt-28">
        <PricingSection />
      </div>
    </main>
  );
}
