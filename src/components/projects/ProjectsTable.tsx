
import React from "react";
import { Project } from "@/services/projectService";
import { ProjectTableHead } from "./ProjectTableHead";
import { ProjectRow } from "./ProjectRow";
import { ProjectTableSkeleton } from "./ProjectTableSkeleton";
import { EmptyProjectsMessage } from "./EmptyProjectsMessage";
import { Table, TableBody } from "@/components/ui/table";

interface ProjectsTableProps {
  loading: boolean;
  filteredProjects: Project[];
  handleDeleteProject: (id: string) => Promise<void>;
  handleEditTitle: (project: Project) => void;
  handleExport: (projectId: string, format: string) => void;
}

export function ProjectsTable({
  loading,
  filteredProjects,
  handleDeleteProject,
  handleEditTitle,
  handleExport
}: ProjectsTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <ProjectTableHead />
          <TableBody>
            {loading ? (
              <ProjectTableSkeleton />
            ) : filteredProjects.length > 0 ? (
              filteredProjects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  handleDeleteProject={handleDeleteProject}
                  handleEditTitle={handleEditTitle}
                  handleExport={handleExport}
                />
              ))
            ) : (
              <EmptyProjectsMessage />
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
