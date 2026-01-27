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
  const [dashboardData, setDashboardData] = useState([]);
  const [annotationSummary, setAnnotationSummary] = useState([]);
  const [hoveredViewId, setHoveredViewId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    const fetchViews = async () => {
      const response = await api.callApi("dmViews", {
        params: { project: projectId },
      });

      const sortedViews = (response ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      setViews(sortedViews);
      setSelectedViewIds((prev) => (prev.length ? prev : sortedViews.map((view) => view.id)));
    };

    fetchViews();
  }, [api, projectId]);

  useEffect(() => {
    if (!projectId) return;

    const fetchDashboard = async () => {
      setLoading(true);
      const response = await api.callApi("dmDashboard", {
        params: {
          project: projectId,
          views: selectedViewIds.join(","),
          annotators: selectedAnnotatorIds.join(","),
        },
      });

      setDashboardData(response?.views ?? []);
      setAnnotationSummary(response?.annotation_summary ?? []);
      setAnnotators(response?.annotators ?? []);
      setSelectedAnnotatorIds((prev) => {
        if (!response?.annotators?.length) return prev.length ? [] : prev;
        const availableIds = new Set(response.annotators.map((annotator) => annotator.id));
        const filtered = prev.filter((id) => availableIds.has(id));
        if (!filtered.length) {
          return response.annotators.map((annotator) => annotator.id);
        }
        return filtered;
      });
      setLoading(false);
    };

    fetchDashboard();
  }, [api, projectId, selectedAnnotatorIds.join(","), selectedViewIds.join(",")]);

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
    history.push(`/projects/${projectId}/data?view=${viewId}`);
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
              onChange={() => toggleAll(
                annotators.map((annotator) => annotator.id),
                selectedAnnotatorIds,
                setSelectedAnnotatorIds,
              )}
            >
              Select all
            </Checkbox>
          </div>
          <div className={dashboardClass.elem("filter-list").toClassName()}>
            {annotators.map((annotator) => (
              <Checkbox
                key={annotator.id}
                checked={selectedAnnotatorIds.includes(annotator.id)}
                onChange={() => toggleSelection(annotator.id, setSelectedAnnotatorIds)}
              >
                {annotator.name}
              </Checkbox>
            ))}
          </div>
        </div>
      </section>

      <section className={dashboardClass.elem("chart").toClassName()}>
        {loading ? (
          <div className={dashboardClass.elem("loading").toClassName()}>
            <Spinner size={48} />
          </div>
        ) : dashboardData.length ? (
          <div className={dashboardClass.elem("bars").toClassName()}>
            {dashboardData.map((view) => {
              const heightPercent = Math.round((view.task_count / maxTasks) * 100);
              const isHovered = hoveredViewId === view.id;

              return (
                <div key={view.id} className={dashboardClass.elem("bar-wrapper").toClassName()}>
                  <button
                    type="button"
                    className={dashboardClass.elem("bar").toClassName()}
                    style={{ height: `${heightPercent}%` }}
                    onClick={() => handleBarClick(view.id)}
                    onMouseEnter={() => setHoveredViewId(view.id)}
                    onMouseLeave={() => setHoveredViewId(null)}
                  >
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
                  <div className={dashboardClass.elem("bar-caption").toClassName()}>{view.title}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={dashboardClass.elem("empty").toClassName()}>
            No tabs selected for the dashboard.
          </div>
        )}
      </section>

      <section className={dashboardClass.elem("chart").toClassName()}>
        {loading ? (
          <div className={dashboardClass.elem("loading").toClassName()}>
            <Spinner size={48} />
          </div>
        ) : annotationSummary.length ? (
          <div className={dashboardClass.elem("bars").toClassName()}>
            {annotationSummary.map((item) => {
              const heightPercent = Math.round((item.total / maxAnnotations) * 100);
              const yesHeight = item.total ? Math.round((item.yes / item.total) * 100) : 0;
              const noHeight = 100 - yesHeight;

              return (
                <div key={item.name} className={dashboardClass.elem("bar-wrapper").toClassName()}>
                  <div
                    className={dashboardClass.elem("bar").mod({ stacked: true }).toClassName()}
                    style={{ height: `${heightPercent}%` }}
                  >
                    <div
                      className={dashboardClass.elem("bar-segment").mod({ yes: true }).toClassName()}
                      style={{ height: `${yesHeight}%` }}
                    >
                      {item.yes}
                    </div>
                    <div
                      className={dashboardClass.elem("bar-segment").mod({ no: true }).toClassName()}
                      style={{ height: `${noHeight}%` }}
                    >
                      {item.no}
                    </div>
                  </div>
                  <div className={dashboardClass.elem("bar-caption").toClassName()}>{item.name}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={dashboardClass.elem("empty").toClassName()}>
            No Yes/No choice annotations found for the selected filters.
          </div>
        )}
      </section>
    </div>
  );
};

ProjectDashboardPage.path = "/dashboard";
