import type { ReactNode } from 'react';
import { Redirect, Route, Switch, useRouteMatch } from 'react-router-dom';
import Spacings from '@commercetools-uikit/spacings';
import CmsList from './components/cms/cms-list';

type ApplicationRoutesProps = {
  children?: ReactNode;
};

// The app implicitly requires the "View" permission; editing additionally checks "Manage" (see cms-editor).
const ApplicationRoutes = (_props: ApplicationRoutesProps) => {
  const match = useRouteMatch();
  return (
    <Spacings.Inset scale="l">
      <Switch>
        <Route path={`${match.path}/blocks`}>
          <CmsList kind="blocks" />
        </Route>
        <Route path={`${match.path}/pages`}>
          <CmsList kind="pages" />
        </Route>
        <Route>
          <Redirect to={`${match.url}/blocks`} />
        </Route>
      </Switch>
    </Spacings.Inset>
  );
};
ApplicationRoutes.displayName = 'ApplicationRoutes';

export default ApplicationRoutes;
