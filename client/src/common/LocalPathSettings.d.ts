export interface romPath {
    path: string;
    name: string;
}

export interface LocalPathSettings {
    bizhawk_path: string;
    rompaths: romPath[];
    server_url: string;
}