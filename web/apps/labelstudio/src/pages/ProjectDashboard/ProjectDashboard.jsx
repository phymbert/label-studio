import { Checkbox } from "@humansignal/ui";
import { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router";
import { Spinner } from "../../components";
import { useAPI } from "../../providers/ApiProvider";
import { useProject } from "../../providers/ProjectProvider";
import { useParams } from "../../providers/RoutesProvider";
import { cn } from "../../utils/bem";

import "./ProjectDashboard.scss";

export const ProjectDashboardPage = () => {
  const api = useAPI();
  const history = useHistory();
  const params = useParams();
  const { project } = useProject();
  const projectId = project?.id ?? params?.id;
  const dashboardClass = cn("project-dashboard");

  const [views, setViews] = useState([]);
  const [selectedViewIds, setSelectedViewIds] = useState([]);
  const [annotators, setAnnotators] = useState([]);
  const [selectedAnnotatorIds, setSelectedAnnotatorIds] = useState([]);
  const [annotatorsRequested, setAnnotatorsRequested] = useState(false);
  const [dashboardData, setDashboardData] = useState([]);
  const [annotationSummary, setAnnotationSummary] = useState([]);
  const [hoveredViewId, setHoveredViewId] = useState(null);
  const [hoveredAnnotationName, setHoveredAnnotationName] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    const fetchViews = async () => {
      const response = await api.callApi("dmViews", {
        params: { project: projectId },
      });

      const sortedViews = (response ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      setViews(sortedViews);
    };

    fetchViews();
  }, [api, projectId]);

  useEffect(() => {
    if (!projectId) return;
    if (!selectedViewIds.length) {
      setDashboardData([]);
      setAnnotationSummary([]);
      setAnnotators([]);
      setSelectedAnnotatorIds([]);
      setAnnotatorsRequested(false);
      setLoading(false);
      return;
    }

    const fetchDashboard = async () => {
      setLoading(true);
      const requestParams = {
        project: projectId,
        views: selectedViewIds.join(","),
      };

      if (annotatorsRequested && selectedAnnotatorIds.length) {
        requestParams.annotators = selectedAnnotatorIds.join(",");
      }
      const response = await api.callApi("dmDashboard", {
        params: requestParams,
      });

      setDashboardData(response?.views ?? []);
      setAnnotationSummary(response?.annotation_summary ?? []);
      setAnnotators(response?.annotators ?? []);
      setSelectedAnnotatorIds((prev) => {
        if (!response?.annotators?.length) return prev.length ? [] : prev;
        const availableIds = new Set(response.annotators.map((annotator) => annotator.id));
        const filtered = prev.filter((id) => availableIds.has(id));
        if (!annotatorsRequested && !filtered.length) {
          return response.annotators.map((annotator) => annotator.id);
        }
        return filtered;
      });
      setLoading(false);
    };

    fetchDashboard();
  }, [
    api,
    projectId,
    annotatorsRequested,
    selectedAnnotatorIds.join(","),
    selectedViewIds.join(","),
  ]);

  const maxTasks = useMemo(() => {
    return Math.max(...dashboardData.map((view) => view.task_count), 1);
  }, [dashboardData]);

  const maxAnnotations = useMemo(() => {
    return Math.max(...annotationSummary.map((item) => item.total), 1);
  }, [annotationSummary]);

  const toggleSelection = (id, setter) => {
    setter((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const toggleAll = (ids, selectedIds, setter) => {
    if (selectedIds.length === ids.length) {
      setter([]);
    } else {
      setter(ids);
    }
  };

  const handleBarClick = (viewId) => {
    const targetProjectId = projectId ?? params?.id;
    if (!targetProjectId) return;
    window.open(`/projects/${targetProjectId}/data?view=${viewId}`, "_blank", "noopener");
  };

  const handleAnnotatorToggle = (id) => {
    setAnnotatorsRequested(true);
    toggleSelection(id, setSelectedAnnotatorIds);
  };

  const handleAnnotatorToggleAll = () => {
    setAnnotatorsRequested(true);
    toggleAll(
      annotators.map((annotator) => annotator.id),
      selectedAnnotatorIds,
      setSelectedAnnotatorIds,
    );
  };

  const hasSelectedViews = selectedViewIds.length > 0;

  const chartColors = ["#22c55e", "#2563eb", "#f97316", "#a855f7", "#ec4899", "#f59e0b"];

  const getChoiceColor = (choiceValue, index) => {
    const normalized = String(choiceValue).toLowerCase();
    if (normalized.includes("yes") || normalized.includes("accept")) return "#22c55e";
    if (normalized.includes("no") || normalized.includes("reject")) return "#ef4444";
    if (normalized.includes("need")) return "#f59e0b";
    return chartColors[index % chartColors.length];
  };

  const renderYAxis = (maxValue) => {
    const ticks = 4;
    const labels = Array.from({ length: ticks + 1 }, (_, index) => {
      const value = Math.round((maxValue / ticks) * (ticks - index));
      return value;
    });

    return (
      <div className={dashboardClass.elem("y-axis").toClassName()}>
        {labels.map((label) => (
          <div key={label} className={dashboardClass.elem("y-axis-label").toClassName()}>
            {label}
          </div>
        ))}
      </div>
    );
  };

  const exportAnnotationCsv = () => {
    if (!annotationSummary.length) return;

    const rows = [["annotation_name", "choice_value", "count", "total", "percentage"]];

    annotationSummary.forEach((item) => {
      const total = item.total || 0;
      item.choices.forEach((choice) => {
        const percentage = total ? ((choice.count / total) * 100).toFixed(2) : "0.00";
        rows.push([item.name, choice.value, choice.count, total, percentage]);
      });
    });

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dashboard-annotations-${projectId ?? "project"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={dashboardClass.toClassName()}>
      <header className={dashboardClass.elem("header").toClassName()}>
        <div>
          <h1>Annotation Monitoring Dashboard</h1>
          <p>Track task volume and annotation coverage across your data manager tabs.</p>
        </div>
      </header>

      <section className={dashboardClass.elem("filters").toClassName()}>
        <div className={dashboardClass.elem("filters-actions").toClassName()}>
          <button
            type="button"
            className={dashboardClass.elem("export-button").toClassName()}
            onClick={exportAnnotationCsv}
            disabled={!annotationSummary.length}
          >
            Export annotations CSV
          </button>
        </div>
        <div className={dashboardClass.elem("filter-group").toClassName()}>
          <div className={dashboardClass.elem("filter-header").toClassName()}>
            <h3>Tabs</h3>
            <Checkbox
              checked={selectedViewIds.length === views.length && views.length > 0}
              onChange={() => toggleAll(
                views.map((view) => view.id),
                selectedViewIds,
                setSelectedViewIds,
              )}
            >
              Select all
            </Checkbox>
          </div>
          <div className={dashboardClass.elem("filter-list").toClassName()}>
            {views.map((view) => (
              <Checkbox
                key={view.id}
                checked={selectedViewIds.includes(view.id)}
                onChange={() => toggleSelection(view.id, setSelectedViewIds)}
              >
                {view.data?.title ?? view.data?.name ?? `View ${view.id}`}
              </Checkbox>
            ))}
          </div>
        </div>

        <div className={dashboardClass.elem("filter-group").toClassName()}>
          <div className={dashboardClass.elem("filter-header").toClassName()}>
            <h3>Annotators</h3>
            <Checkbox
              checked={selectedAnnotatorIds.length === annotators.length && annotators.length > 0}
              onChange={handleAnnotatorToggleAll}
            >
              Select all
            </Checkbox>
          </div>
          <div className={dashboardClass.elem("filter-list").toClassName()}>
            {annotators.map((annotator) => (
              <Checkbox
                key={annotator.id}
                checked={selectedAnnotatorIds.includes(annotator.id)}
                onChange={() => handleAnnotatorToggle(annotator.id)}
              >
                {annotator.name}
              </Checkbox>
            ))}
          </div>
        </div>
      </section>

      <section className={dashboardClass.elem("chart").toClassName()}>
        {!hasSelectedViews ? (
          <div className={dashboardClass.elem("empty").toClassName()}>
            Select at least one tab to load the dashboard.
          </div>
        ) : loading ? (
          <div className={dashboardClass.elem("loading").toClassName()}>
            <Spinner size={48} />
          </div>
        ) : dashboardData.length ? (
          <div className={dashboardClass.elem("chart-body").toClassName()}>
            {renderYAxis(maxTasks)}
            <div className={dashboardClass.elem("bars").toClassName()}>
              {dashboardData.map((view) => {
                const heightPercent = Math.round((view.task_count / maxTasks) * 100);
                const isHovered = hoveredViewId === view.id;
                const annotatedHeight = view.task_count
                  ? Math.round((view.annotated_count / view.task_count) * 100)
                  : 0;
                const remainingHeight = 100 - annotatedHeight;

                return (
                  <div key={view.id} className={dashboardClass.elem("bar-wrapper").toClassName()}>
                    <button
                      type="button"
                      className={dashboardClass.elem("bar").mod({ stacked: true }).toClassName()}
                      style={{ height: `${heightPercent}%` }}
                      onClick={() => handleBarClick(view.id)}
                      onMouseEnter={() => setHoveredViewId(view.id)}
                      onMouseLeave={() => setHoveredViewId(null)}
                    >
                      <div
                        className={dashboardClass.elem("bar-segment").toClassName()}
                        style={{ height: `${annotatedHeight}%`, background: "#2563eb" }}
                      >
                        {view.annotated_count}
                      </div>
                      <div
                        className={dashboardClass.elem("bar-segment").toClassName()}
                        style={{ height: `${remainingHeight}%`, background: "#93c5fd" }}
                      >
                        {view.task_count - view.annotated_count}
                      </div>
                      <span className={dashboardClass.elem("bar-label").toClassName()}>
                        {view.annotated_count}/{view.task_count}
                      </span>
                      {isHovered && (
                        <div className={dashboardClass.elem("tooltip").toClassName()}>
                          <div className={dashboardClass.elem("tooltip-title").toClassName()}>
                            {view.title}
                          </div>
                          {view.annotators.length ? (
                            <ul>
                              {view.annotators.map((annotator) => (
                                <li key={annotator.id}>
                                  {annotator.name}: {annotator.task_count}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className={dashboardClass.elem("tooltip-empty").toClassName()}>
                              No annotations for selected annotators.
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                    <div className={dashboardClass.elem("bar-caption").toClassName()}>
                      {view.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={dashboardClass.elem("empty").toClassName()}>
            No data available for the selected tabs.
          </div>
        )}
      </section>

      <section className={dashboardClass.elem("chart").toClassName()}>
        {!hasSelectedViews ? (
          <div className={dashboardClass.elem("empty").toClassName()}>
            Select at least one tab to load annotation summaries.
          </div>
        ) : loading ? (
          <div className={dashboardClass.elem("loading").toClassName()}>
            <Spinner size={48} />
          </div>
        ) : annotationSummary.length ? (
          <div className={dashboardClass.elem("chart-body").toClassName()}>
            {renderYAxis(maxAnnotations)}
            <div className={dashboardClass.elem("bars").toClassName()}>
              {annotationSummary.map((item) => {
                const heightPercent = Math.round((item.total / maxAnnotations) * 100);
                const isHovered = hoveredAnnotationName === item.name;

                return (
                  <div
                    key={item.name}
                    className={dashboardClass.elem("bar-wrapper").toClassName()}
                    onMouseEnter={() => setHoveredAnnotationName(item.name)}
                    onMouseLeave={() => setHoveredAnnotationName(null)}
                  >
                    <div
                      className={dashboardClass.elem("bar").mod({ stacked: true }).toClassName()}
                      style={{ height: `${heightPercent}%` }}
                    >
                      {item.choices.map((choice, index) => {
                        const segmentHeight = item.total
                          ? Math.round((choice.count / item.total) * 100)
                          : 0;

                        return (
                          <div
                            key={`${choice.value}-${index}`}
                            className={dashboardClass.elem("bar-segment").toClassName()}
                            style={{
                              height: `${segmentHeight}%`,
                              background: getChoiceColor(choice.value, index),
                            }}
                          >
                            {choice.count}
                          </div>
                        );
                      })}
                    </div>
                    <div className={dashboardClass.elem("bar-caption").toClassName()}>
                      {item.name}
                    </div>
                    {isHovered && (
                      <div className={dashboardClass.elem("tooltip").toClassName()}>
                        <div className={dashboardClass.elem("tooltip-title").toClassName()}>
                          {item.name}
                        </div>
                        <ul>
                          {item.choices.map((choice) => (
                            <li key={choice.value}>
                              {choice.value}: {choice.count}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={dashboardClass.elem("empty").toClassName()}>
            No choice annotations found for the selected filters.
          </div>
        )}
      </section>
    </div>
  );
};

ProjectDashboardPage.path = "/dashboard";
