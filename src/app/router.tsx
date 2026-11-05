import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { lazy, Suspense } from "react";
import AuthLayout from "@/components/layouts/auth-layout";
import MainLayout from "@/components/layouts/main-layout";
import RouteError from "@/components/containers/route-error";
import { BASE_PATH } from "@/lib/consts";

const LoginPage = lazy(() => import("@/pages/auth/login"));
const ClusterPage = lazy(() => import("@/pages/cluster/page"));
const HomePage = lazy(() => import("@/pages/home/page"));
const BucketsPage = lazy(() => import("@/pages/buckets/page"));
const ManageBucketPage = lazy(() => import("@/pages/buckets/manage/page"));
const KeysPage = lazy(() => import("@/pages/keys/page"));
const NotFoundPage = lazy(() => import("@/pages/not-found"));

const router = createBrowserRouter(
  [
    {
      path: "/auth",
      Component: AuthLayout,
      // A login chunk that fails to load (stale tab) gets the same Reload screen as the shell, not the router default.
      errorElement: (
        <main className="mx-auto max-w-3xl p-4 md:p-8">
          <RouteError />
        </main>
      ),
      children: [
        {
          path: "login",
          Component: LoginPage,
        },
      ],
    },
    {
      path: "/",
      Component: MainLayout,
      // A render error in the shell itself (the nested one below only covers pages): no shell around it.
      errorElement: (
        <main className="mx-auto max-w-3xl p-4 md:p-8">
          <RouteError />
        </main>
      ),
      children: [
        {
          errorElement: <RouteError />,
          children: [
            {
              index: true,
              Component: HomePage,
            },
            {
              path: "cluster",
              Component: ClusterPage,
            },
            {
              path: "buckets",
              children: [
                { index: true, Component: BucketsPage },
                { path: ":id", Component: ManageBucketPage },
              ],
            },
            {
              path: "keys",
              Component: KeysPage,
            },
            { path: "*", Component: NotFoundPage },
          ],
        },
      ],
    },
  ],
  {
    basename: BASE_PATH,
  },
);

const Router = () => {
  return (
    <Suspense>
      <RouterProvider router={router} />
    </Suspense>
  );
};

export default Router;
