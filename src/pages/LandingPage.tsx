
import { Button } from "@/components/ui/button";
import { ArrowRight, Layout, CheckCircle, Key, FileText, Upload } from "lucide-react";
import { Link } from "react-router-dom";

const LandingPage = () => {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary text-primary-foreground">
              <Layout className="h-5 w-5" />
            </div>
            <span className="font-semibold text-lg">InsightSlide</span>
          </div>
          
          <nav className="hidden md:flex gap-6">
            <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium hover:text-primary transition-colors">How it Works</a>
            <a href="#faq" className="text-sm font-medium hover:text-primary transition-colors">FAQ</a>
          </nav>
          
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Login</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>
      
      {/* Hero section */}
      <section className="py-20 border-b bg-gradient-to-b from-accent to-background">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <h1 className="text-5xl font-bold leading-tight">
                Transform video content into structured slide decks
              </h1>
              <p className="text-xl text-muted-foreground">
                InsightSlide uses AI to analyze educational videos and create comprehensive, editable slide decks for study, review, and teaching.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="gap-2">
                  <Link to="/register">
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/login">
                    Login
                  </Link>
                </Button>
              </div>
            </div>
            
            <div className="relative aspect-video rounded-xl overflow-hidden shadow-xl border">
              <img
                src="/lovable-uploads/eabb2f69-00a5-4556-860a-ac4b00284a5d.png"
                alt="InsightSlide Interface"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>
      
      {/* Features section */}
      <section id="features" className="py-20">
        <div className="container">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">Powerful Features</h2>
            <p className="text-muted-foreground">
              Built for educators, researchers, and students who need to extract structured information from video content.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Upload className="h-8 w-8" />}
              title="Flexible Input"
              description="Upload video files, link to YouTube/Vimeo, or directly paste transcripts to generate slides."
            />
            <FeatureCard
              icon={<FileText className="h-8 w-8" />}
              title="Advanced Processing"
              description="AI-powered extraction of key concepts, definitions, and hierarchical relationships."
            />
            <FeatureCard
              icon={<Key className="h-8 w-8" />}
              title="Secure API Management"
              description="Safely store and manage your OpenAI API keys with client-side encryption."
            />
          </div>
        </div>
      </section>
      
      {/* How it works */}
      <section id="how-it-works" className="py-20 bg-muted/30 border-y">
        <div className="container">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground">
              Turn any educational video into a structured slide deck in just a few steps.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              number="1"
              title="Upload Content"
              description="Select a video file, YouTube link, or paste a transcript into InsightSlide."
            />
            <StepCard
              number="2"
              title="Process with AI"
              description="Our system analyses the content and extracts key concepts, organized hierarchically."
            />
            <StepCard
              number="3"
              title="Edit & Export"
              description="Refine the generated slides as needed, then export to PDF, CSV, or Anki formats."
            />
          </div>
        </div>
      </section>
      
      {/* Testimonials */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">Who Uses InsightSlide?</h2>
            <p className="text-muted-foreground">
              Designed for academic professionals and knowledge workers who need to process educational content efficiently.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <TestimonialCard
              quote="I've been able to convert hours of lecture recordings into concise, well-structured study materials in a fraction of the time it would take manually."
              name="Dr. Sarah Chen"
              role="Associate Professor, Computer Science"
              imageUrl="/lovable-uploads/f64e6eb6-5666-4075-84a0-048e723d7236.png"
            />
            <TestimonialCard
              quote="InsightSlide has transformed how I prepare for my seminars. It extracts exactly what I need from research presentations and organizes them logically."
              name="Michael Rodriguez"
              role="PhD Candidate, Neuroscience"
              imageUrl="/lovable-uploads/9993c960-3884-4f8d-b27e-fd13822400c4.png"
            />
            <TestimonialCard
              quote="As an online course creator, this tool saves me hours of work distilling video content into downloadable resources for my students."
              name="Emma Thompson"
              role="Educational Content Creator"
              imageUrl="/lovable-uploads/f3ca8d01-d2c5-487d-ac22-5be0fa30450d.png"
            />
          </div>
        </div>
      </section>
      
      {/* CTA section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl font-bold">Ready to transform your video content?</h2>
            <p className="text-xl opacity-90">
              Join InsightSlide today and start creating structured, accessible slide decks from your educational videos.
            </p>
            <Button asChild size="lg" variant="secondary">
              <Link to="/register">
                Get Started for Free
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <div className="text-sm opacity-75">No credit card required</div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-12 bg-muted/30 border-t">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary text-primary-foreground">
                  <Layout className="h-5 w-5" />
                </div>
                <span className="font-semibold text-lg">InsightSlide</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Transform video content into structured slide decks with AI.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How It Works</a></li>
                <li><a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Support</h4>
              <ul className="space-y-2">
                <li><a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</a></li>
                <li><a href="#docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact Us</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-12 pt-6 text-center text-sm text-muted-foreground">
            &copy; 2025 InsightSlide. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => {
  return (
    <div className="flex flex-col p-6 bg-card border rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
};

const StepCard = ({ number, title, description }: { number: string; title: string; description: string }) => {
  return (
    <div className="flex flex-col items-center text-center p-6">
      <div className="h-16 w-16 rounded-full bg-primary/15 text-primary flex items-center justify-center text-2xl font-bold mb-4">
        {number}
      </div>
      <h3 className="text-xl font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
};

const TestimonialCard = ({ quote, name, role, imageUrl }: { quote: string; name: string; role: string; imageUrl: string }) => {
  return (
    <div className="flex flex-col p-6 bg-card border rounded-lg shadow-sm">
      <div className="mb-4 text-primary">
        <CheckCircle className="h-6 w-6" />
      </div>
      <blockquote className="text-lg mb-6">"{quote}"</blockquote>
      <div className="flex items-center gap-3 mt-auto">
        <div className="h-10 w-10 rounded-full overflow-hidden">
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        </div>
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-sm text-muted-foreground">{role}</div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
