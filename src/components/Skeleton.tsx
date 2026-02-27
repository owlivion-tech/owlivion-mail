
function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-owl-bg-secondary/60 rounded animate-pulse ${className}`} />
  );
}

export function EmailListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-owl-border/50">
          <SkeletonBox className="w-5 h-5 rounded-full flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between">
              <SkeletonBox className="h-4 w-28" />
              <SkeletonBox className="h-3 w-12" />
            </div>
            <SkeletonBox className="h-4 w-3/4" />
            <SkeletonBox className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmailDetailSkeleton() {
  return (
    <div className="p-6 space-y-4">
      {/* Subject */}
      <SkeletonBox className="h-7 w-2/3" />

      {/* Sender info */}
      <div className="flex items-center gap-3">
        <SkeletonBox className="w-10 h-10 rounded-full" />
        <div className="space-y-2">
          <SkeletonBox className="h-4 w-36" />
          <SkeletonBox className="h-3 w-48" />
        </div>
      </div>

      {/* Body */}
      <div className="space-y-3 pt-4">
        <SkeletonBox className="h-4 w-full" />
        <SkeletonBox className="h-4 w-5/6" />
        <SkeletonBox className="h-4 w-4/5" />
        <SkeletonBox className="h-4 w-3/4" />
        <SkeletonBox className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export function FolderListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1 px-2 py-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <SkeletonBox className="w-5 h-5" />
          <SkeletonBox className="h-4 flex-1" />
          <SkeletonBox className="h-4 w-6 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export { SkeletonBox };
