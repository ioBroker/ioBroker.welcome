import React from 'react';

import {
    LinearProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Checkbox,
    Switch,
    FormControlLabel,
} from '@mui/material';
// important to make from package and not from some children.
// invalid
// import ConfigGeneric from '@iobroker/adapter-react-v5/ConfigGeneric';
// valid
import { I18n } from '@iobroker/adapter-react-v5';
import { ConfigGeneric, type ConfigGenericProps, type ConfigGenericState } from '@iobroker/json-config';

const SUPPORTED_ADAPTERS = ['admin', 'web'];

function getText(word: ioBroker.StringOrTranslated): string {
    if (typeof word === 'string') {
        return word;
    }
    return word[I18n.getLanguage()] || word.en || '';
}

interface WelcomeComponentState extends ConfigGenericState {
    instances: { id: string; icon?: string | null; title: ioBroker.StringOrTranslated; name: string }[] | null;
}

export default class WelcomeComponent extends ConfigGeneric<ConfigGenericProps, WelcomeComponentState> {
    constructor(props: ConfigGenericProps) {
        super(props);
        this.state = {
            ...this.state,
            instances: null,
        };
    }

    async componentDidMount(): Promise<void> {
        super.componentDidMount();

        await this.readData();
    }

    async readData(): Promise<void> {
        const instances = await this.props.oContext.socket.getObjectViewSystem('instance', 'system.adapter.');
        const result: { id: string; icon?: string | null; title: ioBroker.StringOrTranslated; name: string }[] = [];
        Object.keys(instances).forEach(id => {
            if (SUPPORTED_ADAPTERS.includes(instances[id].common.name)) {
                result.push({
                    id: id.replace('system.adapter.', ''),
                    icon: instances[id].common.icon,
                    title: instances[id].common.titleLang ||
                        instances[id].common.title || { en: instances[id].common.name },
                    name: instances[id].common.name,
                });
            }
        });
        result.sort((a, b) => a.id.localeCompare(b.id));

        const icons: { [name: string]: { mimeType: string; file: string } } = {};
        for (let i = 0; i < result.length; i++) {
            const iconName = result[i].icon;
            try {
                const icon =
                    icons[result[i].name] ||
                    (iconName &&
                        (await this.props.oContext.socket.readFile(`${result[i].name}.admin`, iconName, true)));
                if (icon) {
                    result[i].icon = `data:${icon.mimeType};base64,${icon.file}`;
                } else {
                    result[i].icon = null;
                }
            } catch {
                result[i].icon = null;
            }
        }

        this.setState({ instances: result });
    }

    renderItem(): React.JSX.Element {
        if (!this.state.instances) {
            return <LinearProgress />;
        }
        return (
            <div style={{ width: '100%' }}>
                <FormControlLabel
                    control={
                        <Switch
                            checked={this.props.data.allInstances !== false}
                            onChange={e => this.onChange('allInstances', e.target.checked)}
                        />
                    }
                    label={I18n.t('welcome_use_all_instances')}
                />
                <TableContainer
                    component={Paper}
                    style={{ width: '100%' }}
                >
                    <Table
                        style={{ width: '100%' }}
                        size="small"
                    >
                        <TableHead>
                            <TableRow>
                                <TableCell style={{ width: 50 }}>{I18n.t('welcome_enabled')}</TableCell>
                                <TableCell>{I18n.t('welcome_instance')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {this.state.instances.map(instance => (
                                <TableRow
                                    key={instance.id}
                                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                >
                                    <TableCell>
                                        <Checkbox
                                            disabled={
                                                this.props.data.allInstances === true ||
                                                this.props.data.allInstances === undefined
                                            }
                                            checked={
                                                this.props.data.allInstances === true ||
                                                this.props.data.allInstances === undefined ||
                                                this.props.data.specificInstances?.includes(instance.id)
                                            }
                                            onClick={() => {
                                                const specificInstances = [
                                                    ...(this.props.data.specificInstances || []),
                                                ];
                                                const pos = specificInstances.indexOf(instance.id);
                                                if (pos !== -1) {
                                                    specificInstances.splice(pos, 1);
                                                } else {
                                                    specificInstances.push(instance.id);
                                                }
                                                specificInstances.sort();
                                                this.onChange('specificInstances', specificInstances);
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell
                                        component="th"
                                        scope="row"
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 5,
                                            }}
                                        >
                                            {instance.icon ? (
                                                <img
                                                    src={instance.icon}
                                                    alt={getText(instance.title)}
                                                    style={{ width: 20, height: 20 }}
                                                />
                                            ) : null}
                                            {instance.id}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </div>
        );
    }
}
