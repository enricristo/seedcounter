import React from 'react';
import { ImageActions } from '../sidebar/ImageActions';
import { Counters } from '../sidebar/Counters';
import { MetadataForm } from '../sidebar/MetadataForm';
import { DifferentialMode } from '../sidebar/DifferentialMode';
import { HelpTip } from '../sidebar/HelpTip';
import type { Metadata, Session } from '../../types';

interface SidebarProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  
  viableCount: number;
  inviableCount: number;
  viablePercent: string;
  inviablePercent: string;
  totalCount: number;
  visualMode: 'dots' | 'numbers';
  setVisualMode: (mode: 'dots' | 'numbers') => void;
  activeClassification?: 'viable' | 'inviable';
  setActiveClassification?: (type: 'viable' | 'inviable') => void;

  metadata: Metadata;
  updateMetadata: <K extends keyof Metadata>(key: K, value: Metadata[K]) => void;
  sessions: Session[];
}

export function Sidebar({
  fileInputRef,
  importInputRef,
  handleFileUpload,
  handleImportJSON,
  viableCount,
  inviableCount,
  viablePercent,
  inviablePercent,
  totalCount,
  visualMode,
  setVisualMode,
  activeClassification,
  setActiveClassification,
  metadata,
  updateMetadata,
  sessions
}: SidebarProps) {
  return (
    <aside className="w-80 border-r border-neutral-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] flex flex-col shrink-0 overflow-y-auto custom-scrollbar transition-colors duration-300">
      <div className="flex flex-col p-5 gap-5 min-h-max">
        {/* Section 1: Files Upload & Import */}
        <ImageActions 
          fileInputRef={fileInputRef}
          importInputRef={importInputRef}
          handleFileUpload={handleFileUpload}
          handleImportJSON={handleImportJSON}
        />

        <hr className="border-neutral-100 dark:border-zinc-800" />

        {/* Section 2: Metrics Counters */}
        <Counters 
          viableCount={viableCount}
          inviableCount={inviableCount}
          viablePercent={viablePercent}
          inviablePercent={inviablePercent}
          totalCount={totalCount}
          visualMode={visualMode}
          setVisualMode={setVisualMode}
          activeClassification={activeClassification}
          setActiveClassification={setActiveClassification}
          plateId={metadata.plate}
          sessions={sessions}
        />

        <hr className="border-neutral-100 dark:border-zinc-800" />

        {/* Section 3: Differential Toggling */}
        <DifferentialMode 
          metadata={metadata}
          updateMetadata={updateMetadata}
          sessions={sessions}
        />

        <hr className="border-neutral-100 dark:border-zinc-800" />

        {/* Section 4: Sample Metadata inputs */}
        <MetadataForm 
          metadata={metadata}
          updateMetadata={updateMetadata}
        />

        <hr className="border-neutral-100 dark:border-zinc-800" />

        {/* Section 5: Dynamic Help Card */}
        <HelpTip />
      </div>
    </aside>
  );
}
