"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Languages,
  Scan,
  Download,
  Sparkles,
  FolderOpen,
  Plus,
  Trash2,
  Image,
  PaintBucket,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Logo } from "~/components/Logo";

export default function Home() {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: projectsData, refetch: refetchProjects } =
    api.project.list.useQuery();

  const createProject = api.project.create.useMutation({
    onSuccess: (data) => {
      toast.success("Project created");
      setIsCreateDialogOpen(false);
      setProjectName("");
      void refetchProjects();
      router.push(`/project/${data.project.id}`);
    },
    onError: (error) => {
      toast.error("Failed to create project", { description: error.message });
    },
  });

  const loadDemoProject = api.project.loadDemoProject.useMutation({
    onSuccess: (data) => {
      toast.success("Demo project loaded");
      void refetchProjects();
      router.push(`/project/${data.project.id}`);
    },
    onError: (error) => {
      toast.error("Failed to load demo", { description: error.message });
    },
  });

  const deleteProject = api.project.delete.useMutation({
    onSuccess: () => {
      toast.success("Project deleted");
      void refetchProjects();
    },
    onError: (error) => {
      toast.error("Delete failed", { description: error.message });
    },
  });

  const handleCreateProject = () => {
    if (!projectName.trim()) {
      toast.error("Enter a project name");
      return;
    }
    createProject.mutate({ name: projectName.trim() });
  };

  const projects = projectsData?.projects ?? [];

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between px-4">
          <Logo size="md" />
          <Badge variant="outline" className="text-xs font-normal">
            OpenAI Contest Entry
          </Badge>
        </div>
      </header>

      <div className="container px-4 py-12">
        <div className="mx-auto max-w-5xl space-y-16">
          {/* Hero */}
          <section className="text-center space-y-6">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Localize Marketing Visuals
                <span className="block text-muted-foreground">with AI Precision</span>
              </h1>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Replace text in screenshots while preserving design integrity.
                Mask regions, generate localized variants, verify quality with drift detection.
              </p>
            </div>

            {/* CTA */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <Button
                size="lg"
                onClick={() => loadDemoProject.mutate()}
                disabled={loadDemoProject.isPending}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {loadDemoProject.isPending ? "Loading..." : "Try Demo Project"}
              </Button>

              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>New Project</DialogTitle>
                    <DialogDescription>
                      Create a localization project for your marketing visual.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Project Name</Label>
                      <Input
                        id="name"
                        placeholder="App Store Screenshot"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                        autoFocus
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => setIsCreateDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateProject}
                        disabled={createProject.isPending || !projectName.trim()}
                      >
                        {createProject.isPending ? "Creating..." : "Create"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </section>

          {/* Features */}
          <section className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Capabilities</h2>
              <p className="text-muted-foreground">Everything you need to localize marketing assets</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                icon={<PaintBucket className="h-5 w-5" />}
                title="Mask Editor"
                description="Paint regions for AI to replace with localized text"
              />
              <FeatureCard
                icon={<Languages className="h-5 w-5" />}
                title="Multi-Locale"
                description="Spanish, French, Arabic with RTL support"
              />
              <FeatureCard
                icon={<Scan className="h-5 w-5" />}
                title="Drift Inspector"
                description="Detect unintended changes with heatmap overlays"
              />
              <FeatureCard
                icon={<Download className="h-5 w-5" />}
                title="Export Suite"
                description="ZIP bundles, montages, per-locale downloads"
              />
            </div>
          </section>

          {/* Projects */}
          {projects.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
                <span className="text-sm text-muted-foreground">
                  {projects.length} project{projects.length !== 1 && "s"}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {projects.map((project) => (
                  <Card
                    key={project.id}
                    className="group cursor-pointer transition-all hover:border-primary/40 hover:bg-muted/30"
                    onClick={() => router.push(`/project/${project.id}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-base truncate">
                              {project.name}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {new Date(project.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </CardDescription>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this project?")) {
                              deleteProject.mutate({ projectId: project.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusIndicator
                            active={project.hasBaseImage}
                            icon={<Image className="h-3 w-3" />}
                            label="Base"
                          />
                          <StatusIndicator
                            active={project.hasMask}
                            icon={<PaintBucket className="h-3 w-3" />}
                            label="Mask"
                          />
                          {project.variantCount > 0 && (
                            <Badge variant="default" className="text-xs h-5">
                              {project.variantCount} variant{project.variantCount !== 1 && "s"}
                            </Badge>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {projects.length === 0 && (
            <section className="text-center py-12 px-4 rounded-lg border border-dashed border-border">
              <div className="mx-auto max-w-sm space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <FolderOpen className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">No projects yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Load the demo project to see LocaleLens in action, or create your own.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="border-t border-border/40 pt-8">
            <div className="flex flex-col items-center gap-4 text-center text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Built with</span>
                <Badge variant="secondary" className="text-xs font-normal">Next.js 15</Badge>
                <Badge variant="secondary" className="text-xs font-normal">tRPC</Badge>
                <Badge variant="secondary" className="text-xs font-normal">Prisma</Badge>
                <Badge variant="secondary" className="text-xs font-normal">OpenAI</Badge>
              </div>
              <p>Local-first architecture. No hosting required.</p>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}

/** Feature card component */
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
      <div className="absolute top-3 right-3">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      </div>
    </Card>
  );
}

/** Status indicator for project cards */
function StatusIndicator({
  active,
  icon,
  label,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  if (!active) return null;

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  );
}
