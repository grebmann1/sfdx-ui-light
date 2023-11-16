// Profiles
import Admin from './Profile/Admin';
import ContractManager from './Profile/ContractManager';
// Custom Objects
import Account from './CustomObject/Account';
// SObjects Describe
import PermissionSet from './SObject/PermissionSet';
// Metadata
import Metadata from './Metadata/Metadata'

const Profile = {
    Admin,ContractManager
};
const SObject = {
    PermissionSet
};
const CustomObject = {
    Account
};
export default {
    Profile,
    CustomObject,
    SObject,
    Metadata
}
