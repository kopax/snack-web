import * as React from 'react';
import { StyleSheet, css } from 'aphrodite';
import querystring from 'query-string';
import parseGitUrl from 'git-url-parse';
import Button from './shared/Button';
import ProgressIndicator from './shared/ProgressIndicator';
import ModalDialog from './shared/ModalDialog';
import LargeInput from './shared/LargeInput';
import LargeTextArea from './shared/LargeTextArea';
import Segment from '../utils/Segment';
import withThemeName, { ThemeName } from './Preferences/withThemeName';
import colors from '../configs/colors';

type Props = {
  visible: boolean;
  onHide: () => void;
  preventRedirectWarning: () => void;
  theme: ThemeName;
};

type State = {
  status: 'idle' | 'importing' | 'error';
  advanced: boolean;
  url: string;
  repo: string;
  path: string;
  branch: string;
};

const TIMEOUT_MS = 45000;

class RepoImportManager extends React.PureComponent<Props, State> {
  state: State = {
    status: 'idle',
    advanced: false,
    url: '',
    repo: '',
    path: '',
    branch: '',
  };

  _hideImportModal = () => {
    Segment.getInstance().logEvent('IMPORT_COMPLETED', { reason: 'dismiss' }, 'importStart');
    this.setState({
      status: 'idle',
      url: '',
      repo: '',
      path: '',
      branch: '',
    });
    this.props.onHide();
  };

  _handleImportRepoClick = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    this.setState({
      status: 'importing',
    });

    // If the import hangs we want to make sure to throw an error
    setTimeout(() => {
      if (this.props.visible && this.state.status === 'importing') {
        this.setState({
          status: 'error',
        });
      }
    }, TIMEOUT_MS);

    let res;
    let snackId;
    let didFail = false;
    try {
      if (!process.env.IMPORT_SERVER_URL) {
        throw new Error('Missing IMPORT_SERVER_URL');
      }
      const IMPORT_API_URL = `${process.env.IMPORT_SERVER_URL}/git`;

      const params: { repo: string; subpath?: string; branch?: string } = {
        repo: this.state.repo,
      };
      if (this.state.path) {
        params.subpath = this.state.path;
      }
      if (this.state.branch) {
        params.branch = this.state.branch;
      }

      res = await fetch(`${IMPORT_API_URL}?${querystring.stringify(params)}`);
      snackId = await res.text();
      if (this.props.visible) {
        if (res.ok) {
          Segment.getInstance().logEvent('IMPORT_COMPLETED', { reason: 'success' }, 'importStart');
          this.props.preventRedirectWarning();
          window.location.href = `/${snackId}`;
        } else {
          didFail = true;
        }
      }
    } catch (e) {
      didFail = true;
    }

    if (didFail) {
      this.setState({
        status: 'error',
      });
      Segment.getInstance().logEvent('IMPORT_COMPLETED', { reason: 'error' }, 'importStart');
    } else {
      this.setState({
        status: 'idle',
      });
    }
  };

  _handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // @ts-ignore
    this.setState({
      [e.target.name]: e.target.value,
    });
  };

  _handleChangeUrl = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const url = e.target.value;
    const parsed = parseGitUrl(url);

    this.setState({
      url,
      repo: `${parsed.protocol}://${parsed.source}/${parsed.owner}/${parsed.name}`,
      path: parsed.filepath,
      branch: parsed.ref,
    });
  };

  render() {
    const { status } = this.state;
    const importing = status === 'importing';
    const error = status === 'error';

    return (
      <ModalDialog
        visible={this.props.visible}
        onDismiss={this._hideImportModal}
        title="Import git repository">
        {importing ? <ProgressIndicator duration={45000} className={css(styles.progress)} /> : null}
        <form onSubmit={this._handleImportRepoClick}>
          <p className={!error ? css(styles.paragraph) : css(styles.errorParagraph)}>
            {!error
              ? 'Import an Expo project from a Git repository.'
              : 'An error occurred during import. This could be because the data provided was invalid, or because the repository referenced is not a properly formatted Expo project.'}
          </p>
          {this.state.advanced ? (
            <React.Fragment>
              <h4 className={css(styles.subtitle)}>Repository URL</h4>
              <LargeInput
                name="repo"
                value={this.state.repo}
                onChange={this._handleChange}
                placeholder={'https://github.com/ide/love-languages.git'}
                autoFocus
              />
              <h4 className={css(styles.subtitle)}>Folder path</h4>
              <LargeInput
                name="path"
                value={this.state.path}
                onChange={this._handleChange}
                placeholder={'/example/app'}
              />
              <h4 className={css(styles.subtitle)}>Branch name</h4>
              <LargeInput
                name="branch"
                value={this.state.branch}
                onChange={this._handleChange}
                placeholder={'master'}
              />
            </React.Fragment>
          ) : (
            <React.Fragment>
              <h4 className={css(styles.subtitle)}>Git URL</h4>
              <LargeTextArea
                minRows={2}
                value={this.state.url}
                onChange={this._handleChangeUrl}
                placeholder="https://github.com/ide/love-languages/tree/master/example/app"
                autoFocus
              />
            </React.Fragment>
          )}
          <button
            type="button"
            onClick={() => this.setState(state => ({ advanced: !state.advanced }))}
            className={css(styles.advanced)}>
            {this.state.advanced ? 'Hide' : 'Show'} advanced options
          </button>
          <div className={css(styles.buttons)}>
            <Button
              large
              disabled={!this.state.url}
              loading={importing}
              type="submit"
              variant="secondary">
              {importing ? 'Importing repository…' : 'Import repository'}
            </Button>
          </div>
        </form>
      </ModalDialog>
    );
  }
}

export default withThemeName(RepoImportManager);

const styles = StyleSheet.create({
  paragraph: {
    margin: '8px 0 16px',
  },

  errorParagraph: {
    margin: '8px 0 16px',
    color: 'red',
  },

  subtitle: {
    fontSize: 16,
    fontWeight: 500,
    padding: 0,
    lineHeight: '22px',
    margin: '16px 0 6px 0',
  },

  progress: {
    marginTop: -16,
  },

  advanced: {
    appearance: 'none',
    background: 'none',
    border: 0,
    padding: '8px 0',
    marginTop: 8,
    textAlign: 'left',
    width: '100%',
    color: colors.primary,
  },

  buttons: {
    margin: '16px 0 0 0',
  },
});
