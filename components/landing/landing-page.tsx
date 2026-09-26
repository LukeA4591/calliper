import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  FileUp,
  ScanLine,
  MousePointer2,
  Factory,
  Search,
  Mail,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { DrawingPreview } from "./drawing-preview";
import "./landing.css";

const checks = [
  [
    "01",
    "The details that belong on every drawing",
    "Missing general tolerances, material and surface finish specifications. Calliper brings overlooked drawing notes into view.",
  ],
  [
    "02",
    "Geometry that deserves a closer look",
    "Deep blind holes and unspecified shoulder radii. Inspect the callout, the calculation and the manufacturing concern together.",
  ],
  [
    "03",
    "Tolerances with context",
    "Explicit linear tolerances screened against ISO 2768 size bands. See which callouts warrant a closer manufacturing review.",
  ],
];

export function LandingPage() {
  return (
    <div className="calliper-landing">
      <header className="landing-nav">
        <Link href="/" aria-label="Calliper home">
          <Brand />
        </Link>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#what-we-check">What we check</a>
          <a href="#manufacturers">Manufacturers</a>
        </nav>
        <div className="landing-nav-actions">
          <Link href="/login">Sign in</Link>
          <Button asChild size="sm">
            <Link href="/register">
              Get started <ArrowUpRight size={14} />
            </Link>
          </Button>
        </div>
      </header>
      <main id="main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="hero-grid" aria-hidden="true" />
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">
              <span /> A SECOND LOOK, BUILT FOR ENGINEERS
            </p>
            <h1 id="landing-title">
              Before the
              <br />
              first cut,
              <br />
              <span>get a second look.</span>
            </h1>
            <p className="landing-intro">
              Spot potential manufacturing problems while they’re still lines on
              a drawing.
            </p>
            <p className="landing-description">
              Calliper turns your engineering PDF into an interactive review.
              Find the concern, see the evidence and understand what it means
              for making your part.
            </p>
            <div className="landing-hero-actions">
              <Button asChild size="xl" variant="outline">
                <Link href="/register">
                  Check your drawing <ArrowUpRight size={17} />
                </Link>
              </Button>
              <a href="#drawing-preview">
                Explore the preview <ArrowDown size={15} />
              </a>
            </div>
            <p className="landing-hero-note">
              Start with a PDF. Bring your engineering judgement.
            </p>
          </div>
          <DrawingPreview />
          <div className="hero-footer">
            <span>FROM DRAWING TO UNDERSTANDING</span>
            <span>
              Built for the details that matter. <ArrowDown size={14} />
            </span>
          </div>
        </section>
        <section
          className="landing-workflow landing-section"
          id="how-it-works"
          aria-labelledby="workflow-title"
        >
          <div className="landing-section-heading">
            <p className="landing-eyebrow">
              LESS SEARCHING. MORE UNDERSTANDING.
            </p>
            <h2 id="workflow-title">
              Your drawing.
              <br />A clearer picture.
            </h2>
            <p>
              A focused workspace that keeps the engineering drawing at the
              centre of every finding.
            </p>
          </div>
          <ol className="landing-steps">
            {[
              {
                icon: FileUp,
                title: "Bring your drawing",
                text: "Upload an engineering PDF. Multi-page drawings, title blocks and the fine print included.",
              },
              {
                icon: ScanLine,
                title: "Give it a second look",
                text: "Choose the pages to analyse. AI checks drawing specifications and potential manufacturing concerns.",
              },
              {
                icon: MousePointer2,
                title: "Go straight to the detail",
                text: "Select a finding to jump to its location. Explore the evidence, calculations and manufacturing considerations.",
              },
            ].map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <div className="step-top">
                  <Icon size={22} strokeWidth={1.5} />
                  <span>0{i + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>
        <section
          className="landing-checks landing-section"
          id="what-we-check"
          aria-labelledby="checks-title"
        >
          <div className="landing-section-heading">
            <p className="landing-eyebrow">A CLOSER LOOK AT THE SMALL THINGS</p>
            <h2 id="checks-title">
              Small details.
              <br />
              Real consequences.
            </h2>
            <p>
              From missing specifications to difficult geometry, see what needs
              attention before your next manufacturing conversation.
            </p>
            <a className="landing-text-link" href="/register">
              See your drawing differently <ArrowUpRight size={17} />
            </a>
          </div>
          <div className="landing-check-list">
            {checks.map(([number, title, text]) => (
              <div key={number}>
                <span>{number}</span>
                <section>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </section>
              </div>
            ))}
            <p className="landing-check-note">
              Includes AS 1100 documentation checks and ISO 2768 tolerance
              screening. Findings are suggestions for engineering review, not
              certification.
            </p>
          </div>
        </section>
        <section
          className="landing-workflow landing-section"
          id="manufacturers"
          aria-labelledby="makers-title"
        >
          <div className="landing-section-heading">
            <p className="landing-eyebrow">FROM DRAWING TO THE RIGHT WORKSHOP</p>
            <h2 id="makers-title">
              Then find
              <br />
              who can make it.
            </h2>
            <p>
              Your review becomes a shortlist. We match you with manufacturers
              equipped to make your part, and show you what they are working
              with.
            </p>
          </div>
          <ol className="landing-steps">
            {[
              {
                icon: Search,
                title: "Matched to your part",
                text: "One step from findings to a shortlist. No spec sheets to cross-reference, no cold search for a workshop that fits.",
              },
              {
                icon: Factory,
                title: "Real machines, real limits",
                text: "Equipment and working dimensions, materials and tolerances, side by side. See what a workshop can actually do.",
              },
              {
                icon: Mail,
                title: "Start the conversation",
                text: "Open a profile and get in touch with your drawing's requirements already in hand.",
              },
            ].map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <div className="step-top">
                  <Icon size={22} strokeWidth={1.5} />
                  <span>0{i + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
          <p className="landing-check-note">
            Capabilities are declared by each manufacturer. A match is a
            starting point for a conversation, not a quote, an endorsement or a
            confirmation that your part can be made.
          </p>
        </section>
        <section
          className="landing-faq landing-section"
          aria-labelledby="faq-title"
        >
          <div className="landing-section-heading">
            <p className="landing-eyebrow">GOOD QUESTIONS</p>
            <h2 id="faq-title">
              Before you
              <br />
              bring a drawing.
            </h2>
          </div>
          <div className="landing-questions">
            <details>
              <summary>
                Do I need a CAD model?<span>+</span>
              </summary>
              <p>
                No. Start with a PDF engineering drawing. Calliper supports
                multi-page PDFs, so you can include the views, dimensions and
                notes that matter.
              </p>
            </details>
            <details>
              <summary>
                Does Calliper replace an engineer’s review?<span>+</span>
              </summary>
              <p>
                No. AI identifies potential concerns and shows its supporting
                evidence. You interpret the drawing and decide what needs
                attention. No findings does not guarantee manufacturability.
              </p>
            </details>
            <details>
              <summary>
                What happens to my drawing?<span>+</span>
              </summary>
              <p>
                Your PDF stays in this browser’s local storage. Analysis results
                are saved to your account. When you choose to analyse, the
                selected page images and text are sent to OpenAI with your
                permission.
              </p>
            </details>
          </div>
        </section>
        <section className="landing-final" aria-labelledby="final-title">
          <p className="landing-eyebrow">MAKE THE NEXT STEP A CLEARER ONE</p>
          <h2 id="final-title">
            Good drawings deserve
            <br />a second look.
          </h2>
          <Button asChild variant="outline" size="xl">
            <Link href="/register">
              Bring your first drawing <ArrowRight size={17} />
            </Link>
          </Button>
          <p>
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </section>
      </main>
      <footer className="landing-footer">
        <Link href="/" aria-label="Calliper home">
          <Brand />
        </Link>
        <p>A clearer path from drawing to making.</p>
        <span>Calliper © {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
