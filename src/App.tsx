import { BookOpen } from "lucide-react";

function App() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Indigo Docs
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Turn any HQ folder into a polished, browsable documentation site.
        </p>
      </div>
    </div>
  );
}

export default App;
